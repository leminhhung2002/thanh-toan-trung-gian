import { describe, expect, it } from '@jest/globals';
import { getSwaggerTitle } from './configure-app';

describe('getSwaggerTitle', () => {
  it('uses the new public API brand name', () => {
    expect(getSwaggerTitle()).toBe('Tài khoản trung gian API');
  });
});
