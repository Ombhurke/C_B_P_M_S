"""Provider boundary and authorization regression tests; no live account or DB used."""
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException

from app.core.auth import digest, password_hash
from app.core.config import settings
from app.core.database import db, Database
from app.core.google_auth import fetch_supabase_user
from app.services.payments import get_provider
from app.services.storage_service import storage_service
from test_api import client, customer_auth, auth, stage_with_headers


def test_customer_password_endpoints_and_legacy_sessions_closed(client):
    assert client.post('/api/v1/auth/register', json={'email': 'a@example.com', 'password': 'a' * 14}).status_code == 404
    with db.transaction() as records:
        records.put('users', 'legacy', {'username': 'legacy', 'role': 'customer', 'active': True,
                    'password_hash': password_hash('old-password-123')})
        records.put('sessions', digest('legacy-session'), {'username': 'legacy', 'expires_at': 9999999999})
    assert client.post('/api/v1/auth/login', json={'username': 'legacy', 'password': 'old-password-123'}).status_code == 401
    assert client.get('/api/v1/auth/me', headers={'Authorization': 'Bearer legacy-session'}).status_code == 401


def test_google_metadata_cannot_escalate_role(client):
    headers = customer_auth(client)
    identity = client.identities[headers['Authorization'][7:]]
    identity['user_metadata'] = {'role': 'admin', 'shop_id': 'shop-demo-1'}
    identity['app_metadata']['role'] = 'admin'
    response = client.get('/api/v1/auth/me', headers=headers)
    assert response.json()['role'] == 'customer'
    assert response.json()['shop_id'] is None
    for url in ['/api/v1/jobs/queue/shop-demo-1', '/api/v1/shops/shop-demo-1/activity']:
        assert client.get(url, headers=headers).status_code == 403
    assert client.post('/api/v1/auth/users', headers=headers, json={'username': 'x', 'password': 'x' * 15}).status_code == 403
    with client.websocket_connect('/ws/queue/shop-demo-1') as socket:
        socket.send_json({'token': headers['Authorization'][7:]})
        assert socket.receive()['type'] == 'websocket.close'


def test_document_identity_is_uuid_not_email(client):
    first = customer_auth(client)
    job = stage_with_headers(client, first)
    other = customer_auth(client, 'second@example.com')
    client.identities[other['Authorization'][7:]]['email'] = 'customer@example.com'
    assert client.get('/api/v1/customer/documents', headers=other).json() == []
    for suffix in ['', '/download']:
        response = client.request('DELETE' if not suffix else 'GET', f"/api/v1/customer/documents/{job['document_id']}{suffix}", headers=other)
        assert response.status_code == 404
    client.identities[first['Authorization'][7:]]['email'] = 'changed@example.com'
    assert len(client.get('/api/v1/customer/documents', headers=first).json()) == 1


@pytest.mark.parametrize('mutation', ['unconfirmed', 'disallowed_provider', 'invalid_id'])
def test_reject_invalid_customer_identity(client, mutation):
    headers = customer_auth(client)
    identity = client.identities[headers['Authorization'][7:]]
    if mutation == 'unconfirmed': identity['email_confirmed_at'] = None
    elif mutation == 'disallowed_provider': identity['app_metadata']['providers'] = ['github']
    else: identity['id'] = 'not-a-uuid'
    assert client.get('/api/v1/auth/me', headers=headers).status_code == 401


def test_accept_email_password_customer_identity(client):
    headers = customer_auth(client)
    identity = client.identities[headers['Authorization'][7:]]
    identity['app_metadata']['providers'] = ['email']
    response = client.get('/api/v1/auth/me', headers=headers)
    assert response.status_code == 200
    assert response.json()['username'] == 'customer@example.com'
    assert response.json()['role'] == 'customer'


def test_unauthorized_routes_and_hidden_docs(client):
    for path in ['/api/v1/customer/documents', '/api/v1/customer/jobs', '/api/v1/jobs/queue/shop-demo-1', '/api/v1/shops/shop-demo-1/activity']:
        assert client.get(path).status_code == 401
        assert client.get(path, headers={'Authorization': 'Bearer forged.jwt.value'}).status_code == 401
    assert client.get('/docs').status_code == 404
    assert client.get('/openapi.json').status_code == 404
    assert client.post('/api/v1/auth/users', headers=auth(client), json={'username': 'supabase:reserved', 'password': 'x' * 15}).status_code == 422


def test_production_refuses_demo_and_local_fallback(client, monkeypatch):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    monkeypatch.setattr(settings, 'PAYMENT_PROVIDER', 'disabled')
    assert client.get('/api/v1/shops').json() == []
    assert client.get('/api/v1/shops/shop-demo-1').status_code == 404
    assert client.post('/api/v1/payments/anything/mock-confirm', json={'order_id': 'fake'}, headers={'X-Checkout-Token': 'fake'}).status_code == 404
    with pytest.raises(HTTPException) as error: get_provider()
    assert error.value.status_code == 503
    with pytest.raises(HTTPException): storage_service.save('job', 'a.pdf', b'abc', 'application/pdf')
    with pytest.raises(ValueError): Database().initialize('sqlite:///:memory:')


@pytest.mark.parametrize('status,expected', [(401, 401), (403, 401), (500, 503), (302, 503)])
def test_provider_http_errors_fail_closed(monkeypatch, status, expected):
    monkeypatch.setattr(settings, 'SUPABASE_URL', 'https://auth.example.test')
    monkeypatch.setattr(settings, 'SUPABASE_PUBLISHABLE_KEY', 'test-publishable')
    def get(url, **kwargs):
        assert url == 'https://auth.example.test/auth/v1/user'
        assert kwargs['follow_redirects'] is False
        assert kwargs['headers']['Authorization'] == 'Bearer invalid.jwt.value'
        return httpx.Response(status)
    monkeypatch.setattr('app.core.google_auth.httpx.get', get)
    with pytest.raises(HTTPException) as error: fetch_supabase_user('invalid.jwt.value')
    assert error.value.status_code == expected


def test_provider_timeout_and_valid_user(monkeypatch):
    monkeypatch.setattr(settings, 'SUPABASE_URL', 'https://auth.example.test')
    monkeypatch.setattr(settings, 'SUPABASE_PUBLISHABLE_KEY', 'test-publishable')
    def timeout(*args, **kwargs): raise httpx.ReadTimeout('timeout')
    monkeypatch.setattr('app.core.google_auth.httpx.get', timeout)
    with pytest.raises(HTTPException) as error: fetch_supabase_user('test.jwt.value')
    assert error.value.status_code == 503
    identity = {'id': str(uuid4())}
    monkeypatch.setattr('app.core.google_auth.httpx.get', lambda *a, **k: httpx.Response(200, json=identity))
    assert fetch_supabase_user('test.jwt.value') == identity


def test_unpaid_account_job_expires_without_trapping_library_deletion(client):
    from app.services.cleanup_service import cleanup_service
    customer = customer_auth(client)
    job = stage_with_headers(client, customer)
    with db.transaction() as records:
        stored = records.get('jobs', job['job_id'])
        stored['expires_at_epoch'] = 1
        records.put('jobs', job['job_id'], stored)
    client.portal.call(cleanup_service.sweep)
    assert client.get('/api/v1/customer/jobs', headers=customer).json()[0]['job_status'] == 'expired'
    assert len(client.get('/api/v1/customer/documents', headers=customer).json()) == 1
    assert client.delete('/api/v1/customer/documents/' + job['document_id'], headers=customer).status_code == 200


def test_deleting_google_account_does_not_revoke_matching_staff_username(client):
    staff = auth(client)
    customer = customer_auth(client, 'admin')
    assert client.delete('/api/v1/auth/me', headers=customer).status_code == 200
    assert client.get('/api/v1/auth/me', headers=staff).status_code == 200


def test_production_cleanup_preserves_unmigrated_local_files(client, monkeypatch):
    import os
    from pathlib import Path
    from app.services.cleanup_service import cleanup_service
    legacy_file = Path(settings.TEMP_STORAGE_DIR) / 'job-old-local-document.pdf'
    legacy_file.write_bytes(b'legacy local document')
    os.utime(legacy_file, (1, 1))
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    client.portal.call(cleanup_service.sweep)
    assert legacy_file.exists()


def test_customer_alias_default_and_update(client):
    headers = customer_auth(client, 'alexandra@example.com')
    me_res = client.get('/api/v1/auth/me', headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()['alias'] == 'alexan'
    assert me_res.json()['alias_chosen'] is False

    update_res = client.patch('/api/v1/customer/alias', headers=headers, json={'alias': 'Alex'})
    assert update_res.status_code == 200
    assert update_res.json()['alias'] == 'Alex'
    assert update_res.json()['alias_chosen'] is True

    me_after = client.get('/api/v1/auth/me', headers=headers)
    assert me_after.json()['alias'] == 'Alex'
    assert me_after.json()['alias_chosen'] is True

