#!/bin/bash

# Se a variável de ambiente DASHSCOPE_API_KEY não estiver definida, aceita por argumento
API_KEY="${DASHSCOPE_API_KEY:-$1}"

echo -e "\033[0;36mConfigurando Claude Code para Qwen (Alibaba Cloud)...\033[0m"

# Se não foi fornecida nenhuma API Key, solicita entrada interativa do usuário
if [ -z "$API_KEY" ]; then
    read -p "API Key nao encontrada no ambiente. Por favor, insira sua API Key do Alibaba Cloud Model Studio: " API_KEY
fi

export ANTHROPIC_BASE_URL="https://ws-gjpft4onkibi8l0z.ap-southeast-1.maas.aliyuncs.com/apps/anthropic"
export ANTHROPIC_AUTH_TOKEN="${API_KEY:-sk-ws-H.XIPYMR.B1cc.MEYCIQDPuv3PIpgZXmd80ktVOgRkRvEL5OISUTaLJmXgQ8psxgIhALO62O3WPDq3q30w1xdvJ9J61bpp9I4w4nHor0gZdm2m}"
export ANTHROPIC_MODEL="qwen3.7-plus"
export ANTHROPIC_DEFAULT_OPUS_MODEL="qwen3.7-plus"
export ANTHROPIC_DEFAULT_SONNET_MODEL="qwen3.7-plus"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="qwen3.6-flash"
export CLAUDE_CODE_SUBAGENT_MODEL="qwen3.6-flash"
export CLAUDE_CODE_EFFORT_LEVEL="max"

echo -e "\033[0;32mIniciando Claude Code com Qwen...\033[0m"
claude
