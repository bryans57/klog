#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if ! command -v bun >/dev/null; then
  echo "Necesitas bun: https://bun.sh" >&2
  exit 1
fi
mkdir -p dist
bun run check
bun run build
mkdir -p "$HOME/.local/bin"
install -m 755 dist/klog "$HOME/.local/bin/klog"
# Bun --compile deja una firma ad-hoc inválida en macOS 26/27 (SIGKILL Code Signature Invalid).
if command -v codesign >/dev/null; then
  codesign --force --sign - dist/klog "$HOME/.local/bin/klog"
fi
echo "Instalado: $HOME/.local/bin/klog"
"$HOME/.local/bin/klog" --version
if [[ -d "$HOME/.oh-my-zsh" ]]; then
  COMP_DIR="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/completions"
  mkdir -p "$COMP_DIR"
  install -m 644 "$ROOT/completions/_klog" "$COMP_DIR/_klog"
  rm -f "$HOME"/.zcompdump*
  echo "Completado zsh: $COMP_DIR/_klog"
  echo "Abre una pestaña nueva y prueba: klog <Tab>"
fi
