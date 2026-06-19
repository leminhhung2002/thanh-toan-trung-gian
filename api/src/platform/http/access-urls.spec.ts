import { getAccessUrls } from './access-urls';

describe('getAccessUrls', () => {
  it('returns localhost and network URLs for wildcard hosts', () => {
    const urls = getAccessUrls({
      host: '0.0.0.0',
      networkAddresses: ['192.168.1.10', '172.18.0.1'],
      port: 3000,
    });

    expect(urls).toEqual({
      docsUrl: 'http://localhost:3000/docs',
      localUrl: 'http://localhost:3000',
      networkUrls: ['http://192.168.1.10:3000', 'http://172.18.0.1:3000'],
    });
  });

  it('returns host-specific URLs for explicit localhost bindings', () => {
    const urls = getAccessUrls({
      host: '127.0.0.1',
      networkAddresses: ['192.168.1.10'],
      port: 3000,
    });

    expect(urls).toEqual({
      docsUrl: 'http://127.0.0.1:3000/docs',
      localUrl: 'http://127.0.0.1:3000',
      networkUrls: [],
    });
  });
});
