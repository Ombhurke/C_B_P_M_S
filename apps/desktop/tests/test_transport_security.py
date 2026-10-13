import pytest

from agent.core.api_client import DesktopApiClient


@pytest.mark.parametrize('url', [
    'http://api.example/api/v1', 'https://user:password@api.example/api/v1',
    'https://api.example/api/v1?token=secret', 'https://api.example/other-path',
])
def test_credentials_cannot_be_sent_to_unsafe_base_urls(url):
    with pytest.raises(ValueError):
        DesktopApiClient(url)


def test_tls_hostname_is_preserved_and_local_http_is_supported():
    assert DesktopApiClient('https://localhost:8000').base_url == 'https://localhost:8000/api/v1'
    assert DesktopApiClient('http://localhost:8000').base_url == 'http://127.0.0.1:8000/api/v1'
    assert DesktopApiClient('https://api.example').base_url == 'https://api.example/api/v1'


def test_invalid_base_url_update_does_not_replace_the_current_destination():
    client = DesktopApiClient('https://api.example/api/v1')
    with pytest.raises(ValueError):
        client.set_base_url('http://evil.example')
    assert client.base_url == 'https://api.example/api/v1'
