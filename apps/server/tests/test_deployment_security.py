"""No live account, payment, storage or database is used by these regressions."""
import hashlib
import hmac

import httpx
import pytest
from fastapi import HTTPException

from app.core.config import Settings, settings
from app.core.database import db
from app.services.payments import RazorpayProvider, get_provider
from test_api import client, auth, stage, pay, claim, customer_auth
from pathlib import Path


def test_public_shop_metadata_does_not_expose_hardware(client):
    headers = auth(client)
    assert client.get('/api/v1/shops/shop-demo-1').json()['printers'] == []
    assert client.get('/api/v1/shops/shop-demo-1').json()['stations'] == []
    assert client.get('/api/v1/shops/shop-demo-1', headers=headers).json()['printers']
    assert client.get('/api/v1/shops/shop-demo-1/printers').status_code == 401
    assert client.get('/api/v1/shops/shop-demo-2/printers', headers=headers).status_code == 403


def test_operator_job_detail_is_a_projection_not_a_storage_record(client):
    job = stage(client)
    with db.transaction() as records:
        stored = records.get('jobs', job['job_id'])
        stored['future_secret'] = 'must-not-be-returned'
        stored['release_token'] = '4821'
        records.put('jobs', job['job_id'], stored)
    path = f"/api/v1/shops/shop-demo-1/jobs/{job['job_id']}"
    assert client.get(path).status_code == 401
    response = client.get(path, headers=auth(client))
    assert response.status_code == 200
    assert response.json()['file_name'] == 'document.pdf'
    forbidden = {'future_secret', 'release_token', 'checkout_hash', 'download_hash',
                 'file_path', 'supabase_path', 'owner_id', 'order'}
    assert not forbidden.intersection(response.json())


def test_another_operator_cannot_finalize_or_reject_an_active_claim(client):
    owner = auth(client)
    client.post('/api/v1/auth/users', headers=owner, json={
        'username': 'other', 'password': 'other-password-test-123', 'role': 'operator',
    })
    other = auth(client, 'other', 'other-password-test-123')
    job = stage(client)
    receipt, _ = pay(client, job)
    confirm = f"/api/v1/jobs/{job['job_id']}/confirm-output"
    assert client.post(confirm, headers=owner, json={}).status_code == 403
    claim(client, receipt, owner)
    assert client.post(confirm, headers=other, json={}).status_code == 403
    assert client.post(f"/api/v1/jobs/{job['job_id']}/report-issue", headers=other,
                       json={'issue_type': 'paper_jam', 'details': 'Not my claim'}).status_code == 403
    assert client.post(f"/api/v1/shops/shop-demo-1/jobs/{job['job_id']}/reject", headers=other,
                       json={'reason': 'Not my claim'}).status_code == 403


@pytest.mark.parametrize('endpoint, field', [
    ('/customer/documents', 'file'), ('/customer/documents/batch', 'files'),
    ('/jobs/stage-folder', 'files'),
])
def test_each_upload_is_bounded_before_reading_into_memory(client, monkeypatch, endpoint, field):
    monkeypatch.setattr(settings, 'MAX_FILE_SIZE_BYTES', 16)
    response = client.post('/api/v1' + endpoint, headers=customer_auth(client),
                           data={'shop_id': 'shop-demo-1', 'folder_name': 'test-folder'},
                           files={field: ('oversized.pdf', b'%PDF-' + b'x' * 64, 'application/pdf')})
    assert response.status_code == 413
    with db.transaction(readonly=True) as records:
        assert records.list('documents') == []
        assert records.list('jobs') == []


@pytest.mark.parametrize('endpoint', ['complete', 'confirm-output'])
def test_completion_audit_failure_cannot_delete_bytes_before_rollback(client, monkeypatch, endpoint):
    owner = auth(client)
    job = stage(client)
    receipt, _ = pay(client, job)
    claim(client, receipt, owner)
    with db.transaction(readonly=True) as records:
        original = records.get('jobs', job['job_id'])
    def fail_audit(*args, **kwargs):
        raise RuntimeError('Injected pre-commit failure')
    monkeypatch.setattr('app.api.v1.release.record_audit', fail_audit)
    payload = {'job_id': job['job_id'], 'status': 'completed'} if endpoint == 'complete' else {}
    with pytest.raises(RuntimeError):
        client.post(f"/api/v1/jobs/{job['job_id']}/{endpoint}", headers=owner, json=payload)
    assert Path(original['file_path']).is_file()
    with db.transaction(readonly=True) as records:
        assert records.get('jobs', job['job_id'])['job_status'] == 'processing'


def test_production_rejects_test_payment_credentials(monkeypatch):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    monkeypatch.setattr(settings, 'PAYMENT_PROVIDER', 'razorpay')
    monkeypatch.setattr(settings, 'RAZORPAY_KEY_ID', 'rzp_test_dummy')
    with pytest.raises(HTTPException) as error:
        get_provider()
    assert error.value.status_code == 503


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(settings, 'RAZORPAY_KEY_ID', 'rzp_test_dummy')
    monkeypatch.setattr(settings, 'RAZORPAY_KEY_SECRET', 'unit-test-secret')
    return RazorpayProvider()


def payment_response(monkeypatch, payload, status=200):
    original_client = httpx.Client
    transport = httpx.MockTransport(lambda request: httpx.Response(status, json=payload))
    monkeypatch.setattr('app.services.payments.httpx.Client',
                        lambda **kwargs: original_client(transport=transport, **kwargs))


def verify(provider):
    signature = hmac.new(b'unit-test-secret', b'order_Test1|pay_Test1', hashlib.sha256).hexdigest()
    return provider.verify_payment('order_Test1', 'pay_Test1', signature, 800, 'INR')


def captured_payment():
    return {'id': 'pay_Test1', 'order_id': 'order_Test1', 'amount': 800,
            'currency': 'INR', 'status': 'captured', 'captured': True}


@pytest.mark.parametrize('change', [
    {'status': 'authorized', 'captured': False}, {'currency': 'USD'}, {'amount': 1},
    {'order_id': 'order_Other'}, {'id': 'pay_Other'}, {'captured': False},
])
def test_gateway_receipt_must_match_and_be_captured(provider, monkeypatch, change):
    payment_response(monkeypatch, {**captured_payment(), **change})
    with pytest.raises(HTTPException) as error:
        verify(provider)
    assert error.value.status_code == 409


def test_valid_capture_and_unsafe_legacy_shortcut(provider, monkeypatch):
    payment_response(monkeypatch, captured_payment())
    assert verify(provider).captured is True
    with pytest.raises(HTTPException):
        provider.verify_capture({'id': 'order_Test1'})


def test_gateway_failure_does_not_echo_provider_response(provider, monkeypatch):
    payment_response(monkeypatch, {'private-diagnostic': 'do-not-echo'}, status=400)
    with pytest.raises(HTTPException) as error:
        provider.create_order('job-Test1', 800, 'INR')
    assert 'do-not-echo' not in error.value.detail


@pytest.mark.parametrize('change', [
    {'CORS_ORIGINS': ['*']}, {'CORS_ORIGIN_REGEX': '.*'}, {'ENABLE_API_DOCS': True},
    {'ALLOW_MOCK_PAYMENTS': True}, {'SUPABASE_PUBLISHABLE_KEY': 'sb_secret_wrong'},
    {'SUPABASE_URL': 'https://user:password@project.supabase.co'},
])
def test_unsafe_production_config_is_rejected(change):
    config = Settings(_env_file=None, **{
        'ENVIRONMENT': 'production', 'SUPABASE_URL': 'https://project.supabase.co',
        'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_unit_test',
        'SUPABASE_SERVICE_ROLE_KEY': 'unit-test-storage-key', **change,
    })
    with pytest.raises(ValueError):
        config.validate_runtime()
