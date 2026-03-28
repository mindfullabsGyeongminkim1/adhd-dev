import { describe, it, expect } from 'vitest';
import {
  generateZshIntegration,
  generateBashIntegration,
  generateTmuxIntegration,
} from '../../src/services/shell-integrator.js';

describe('generateZshIntegration', () => {
  it('returns a non-empty string', () => {
    const result = generateZshIntegration();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains RPROMPT', () => {
    expect(generateZshIntegration()).toContain('RPROMPT');
  });

  it('contains adhd-dev prompt-status', () => {
    expect(generateZshIntegration()).toContain('adhd-dev prompt-status');
  });

  it('contains zshrc reference', () => {
    expect(generateZshIntegration()).toContain('.zshrc');
  });
});

describe('generateBashIntegration', () => {
  it('returns a non-empty string', () => {
    const result = generateBashIntegration();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains PS1', () => {
    expect(generateBashIntegration()).toContain('PS1');
  });

  it('contains adhd-dev prompt-status', () => {
    expect(generateBashIntegration()).toContain('adhd-dev prompt-status');
  });

  it('contains bashrc reference', () => {
    expect(generateBashIntegration()).toContain('.bashrc');
  });
});

describe('generateTmuxIntegration', () => {
  it('returns a non-empty string', () => {
    const result = generateTmuxIntegration();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains status-right', () => {
    expect(generateTmuxIntegration()).toContain('status-right');
  });

  it('contains adhd-dev tmux-status', () => {
    expect(generateTmuxIntegration()).toContain('adhd-dev tmux-status');
  });

  it('contains tmux.conf reference', () => {
    expect(generateTmuxIntegration()).toContain('.tmux.conf');
  });
});
