import { describe, expect, it } from 'vitest';
import * as legacy from '../legacy';
import * as v2 from '../v2';
import * as root from '../index';

describe('@kinevo/shared/tokens · snapshot', () => {
  it('legacy paleta — baseline determinístico', () => {
    expect(legacy).toMatchSnapshot();
  });

  it('v2 paleta — baseline determinístico', () => {
    expect(v2).toMatchSnapshot();
  });

  it('root index reexporta legacy como default + v2 como namespace', () => {
    expect(root.colors).toBe(legacy.colors);
    expect(root.spacing).toBe(legacy.spacing);
    expect(root.typography).toBe(legacy.typography);
    expect(root.shadows).toBe(legacy.shadows);
    expect(root.radius).toBe(legacy.radius);
    expect(root.motion).toBe(legacy.motion);
    expect(root.v2.colors).toBe(v2.colors);
  });
});
