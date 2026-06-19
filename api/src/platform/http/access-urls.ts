import { networkInterfaces } from 'os';

type GetAccessUrlsOptions = {
  host: string;
  networkAddresses?: string[];
  port: number;
};

function isWildcardHost(host: string) {
  return host === '0.0.0.0' || host === '::';
}

function getNetworkAddresses() {
  const interfaces = networkInterfaces();
  const addresses = new Set<string>();

  Object.values(interfaces).forEach((entries) => {
    entries?.forEach((entry) => {
      if (entry.family !== 'IPv4' || entry.internal) {
        return;
      }

      addresses.add(entry.address);
    });
  });

  return [...addresses];
}

export function getAccessUrls({
  host,
  networkAddresses = getNetworkAddresses(),
  port,
}: GetAccessUrlsOptions) {
  const baseHost = isWildcardHost(host) ? 'localhost' : host;
  const localUrl = `http://${baseHost}:${port}`;
  const docsUrl = `${localUrl}/docs`;

  const networkUrls = isWildcardHost(host)
    ? networkAddresses.map((address) => `http://${address}:${port}`)
    : [];

  return {
    docsUrl,
    localUrl,
    networkUrls,
  };
}
