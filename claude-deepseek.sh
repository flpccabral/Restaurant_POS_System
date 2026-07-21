#!/bin/bash

# Se a variável de ambiente DEEPSEEK_API_KEY não estiver definida, aceita por argumento
API_KEY="${DEEPSEEK_API_KEY:-$1}"

echo -e "\033[0;36mConfigurando Claude Code para DeepSeek...\033[0m"

export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="${API_KEY:-sk-27414aa3bfe4418eb06c35b0d0580a16}"
export ANTHROPIC_MODEL="deepseek-v4-pro"
export ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro"
export ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_EFFORT_LEVEL="max"

echo -e "\033[0;32mIniciando Claude Code...\033[0m"
claude
