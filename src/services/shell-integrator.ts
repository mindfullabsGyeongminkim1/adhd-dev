/**
 * Generate shell integration snippets for zsh, bash, and tmux.
 */

export function generateZshIntegration(): string {
  return [
    '# ADHD-Dev shell integration',
    '# Add to ~/.zshrc',
    '',
    '# adhd() wrapper — enables `adhd go <project>` to cd into the project',
    'adhd() {',
    '  eval "$(command adhd-dev "$@")" 2>/dev/null || command adhd-dev "$@"',
    '}',
    '',
    '# RPROMPT integration (shows timer, badge, and state)',
    'adhd_rprompt() {',
    '  command adhd-dev prompt-status 2>/dev/null',
    '}',
    'RPROMPT=\'$(adhd_rprompt)\'',
    '',
    '# Optional: auto-start daemon if not running',
    '# if ! adhd-dev daemon status &>/dev/null; then adhd-dev daemon start; fi',
  ].join('\n');
}

export function generateBashIntegration(): string {
  return [
    '# ADHD-Dev shell integration',
    '# Add to ~/.bashrc',
    '',
    '# adhd() wrapper — enables `adhd go <project>` to cd into the project',
    'adhd() {',
    '  eval "$(command adhd-dev "$@")" 2>/dev/null || command adhd-dev "$@"',
    '}',
    '',
    '# PS1 integration (shows timer and badge at prompt)',
    'adhd_ps1() {',
    '  command adhd-dev prompt-status 2>/dev/null',
    '}',
    '',
    '# Append to existing PS1:',
    '# PS1="\\$(adhd_ps1) $PS1"',
    '',
    '# Optional: auto-start daemon if not running',
    '# if ! adhd-dev daemon status &>/dev/null; then adhd-dev daemon start; fi',
  ].join('\n');
}

export function generateTmuxIntegration(): string {
  return [
    '# ADHD-Dev tmux integration',
    '# Add to ~/.tmux.conf',
    '',
    '# Show ADHD-Dev status in tmux status-right',
    'set -g status-right "#(adhd-dev tmux-status) | %H:%M"',
    '',
    '# Refresh tmux status every 2 seconds',
    'set -g status-interval 2',
  ].join('\n');
}
