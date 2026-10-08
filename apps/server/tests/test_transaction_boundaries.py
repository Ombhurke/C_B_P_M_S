"""Failure injection for the dashboard foundation; fixtures never use live services.

Strict xfails document unresolved cross-system atomicity requirements. They are
not passing guarantees; remove xfail when the durable cleanup workflow is built.
"""
from pathlib import Path

import pytest

from app.core.config import settings
from app.core.database import db
from app.services.storage_service import storage_service
from test_api import client, auth, stage, customer_auth, stage_with_headers


class InjectedFailure(RuntimeError):
    pass


def reject_audit(*args, **kwargs):
    raise InjectedFailure('Deliberate failure before commit')


def test_transaction_reverts_insert_update_and_delete(client):
    with db.transaction() as records:
        records.put('attempts', 'rollback-check', {'count': 1})
        records.put('audit_events', 'existing-event', {'action': 'keep'})
    with pytest.raises(InjectedFailure):
        with db.transaction() as records:
            records.put('attempts', 'rollback-check', {'count': 2})
            records.put('documents', 'uncommitted-document', {'status': 'available'})
            records.remove('audit_events', 'existing-event')
            raise InjectedFailure()
    with db.transaction() as records:
        assert records.get('attempts', 'rollback-check') == {'count': 1}
        assert records.get('documents', 'uncommitted-document') is None
        assert records.get('audit_events', 'existing-event') == {'action': 'keep'}


def test_staging_audit_failure_rolls_back_metadata_and_compensates_file(client, monkeypatch):
    monkeypatch.setattr('app.api.v1.jobs.record_audit', reject_audit)
    with pytest.raises(InjectedFailure):
        stage(client)
    with db.transaction() as records:
        assert records.list('jobs') == []
        assert records.list('documents') == []
        assert records.list('audit_events') == []
    assert list(Path(settings.TEMP_STORAGE_DIR).glob('job-*')) == []


def test_rates_and_audit_share_transaction(client, monkeypatch):
    headers = auth(client)
    original = client.get('/api/v1/shops/shop-demo-1').json()
    monkeypatch.setattr('app.api.v1.shops.record_audit', reject_audit)
    with pytest.raises(InjectedFailure):
        client.patch('/api/v1/shops/shop-demo-1', headers=headers, json={'base_bw_rate': 99})
    assert client.get('/api/v1/shops/shop-demo-1').json() == original


def test_payment_queue_and_audit_share_transaction(client, monkeypatch):
    job = stage(client)
    headers = {'X-Checkout-Token': job['checkout_token']}
    order = client.post(f"/api/v1/payments/{job['job_id']}/order", headers=headers).json()
    monkeypatch.setattr('app.api.v1.checkout.record_audit', reject_audit)
    with pytest.raises(InjectedFailure):
        client.post(f"/api/v1/payments/{job['job_id']}/mock-confirm", headers=headers,
                    json={'order_id': order['id']})
    with db.transaction() as records:
        unchanged = records.get('jobs', job['job_id'])
        assert unchanged['payment_status'] == 'pending'
        assert unchanged['job_status'] == 'staged'
        assert unchanged['release_token'] is None
        assert not any(e['action'] == 'payment.mock_completed' for e in records.list('audit_events'))


def test_library_delete_failure_must_preserve_file_or_durable_cleanup_intent(client, monkeypatch):
    headers = customer_auth(client)
    job = stage_with_headers(client, headers)
    with db.transaction() as records:
        stored = records.get('jobs', job['job_id'])
        stored['job_status'] = 'expired'
        records.put('jobs', stored['id'], stored)
        document = records.get('documents', job['document_id'])
    monkeypatch.setattr('app.api.v1.customer.record_audit', reject_audit)
    with pytest.raises(InjectedFailure):
        client.delete(f"/api/v1/customer/documents/{job['document_id']}", headers=headers)
    with db.transaction() as records:
        retained = records.get('documents', job['document_id'])
        assert retained is not None
    assert Path(document['file_path']).exists() or retained.get('status') == 'deleting'


def test_failed_upload_compensation_must_leave_durable_retry_record(client, monkeypatch):
    monkeypatch.setattr('app.api.v1.jobs.record_audit', reject_audit)
    monkeypatch.setattr(storage_service, 'purge', lambda job: False)
    with pytest.raises(InjectedFailure):
        stage(client)
    remaining = list(Path(settings.TEMP_STORAGE_DIR).glob('job-*'))
    with db.transaction() as records:
        tracked = any(j.get('cleanup_pending') for j in records.list('jobs'))
    # A later local-file sweep is test-only; it cannot recover a production cloud orphan.
    assert not remaining or tracked
