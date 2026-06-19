import { getCorsOrigins } from './cors';

describe('getCorsOrigins', () => {
  it('returns the local development defaults when no env value is provided', () => {
    expect(getCorsOrigins()).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ]);
  });

  it('parses, trims and deduplicates configured origins', () => {
    expect(
      getCorsOrigins(
        ' https://app.example.com ,https://admin.example.com,https://app.example.com ,, ',
      ),
    ).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });
});
