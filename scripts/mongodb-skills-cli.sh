#!/usr/bin/env bash
set -euo pipefail

# Strict installer for MongoDB Agent Skills.
# Installs ONLY to selected agents (no universal-agent auto-expansion).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_SRC_ROOT="$REPO_ROOT/plugins/mongodb-agent-skills/skills"

ALL_SKILLS=(
  "mongodb-ai"
  "mongodb-query-and-index-optimize"
  "mongodb-schema-design"
  "mongodb-transactions-consistency"
)

DEFAULT_AGENTS=("claude-code" "codex" "cursor")

usage() {
  cat <<USAGE
Usage:
  ./scripts/mongodb-skills-cli.sh install-all [--agents a,b,c]
  ./scripts/mongodb-skills-cli.sh install-select --skills s1,s2 [--agents a,b,c]
  ./scripts/mongodb-skills-cli.sh uninstall-all [--agents a,b,c]
  ./scripts/mongodb-skills-cli.sh uninstall-select --skills s1,s2 [--agents a,b,c]
  ./scripts/mongodb-skills-cli.sh reset [--agents a,b,c]
  ./scripts/mongodb-skills-cli.sh list [--agents a,b,c]

Agents:
  claude-code, codex, cursor

Skills:
  mongodb-ai, mongodb-query-and-index-optimize, mongodb-schema-design, mongodb-transactions-consistency
USAGE
}

split_csv() {
  local csv="$1"
  local -n out_ref="$2"
  IFS=',' read -r -a out_ref <<< "$csv"
}

contains() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

agent_dir() {
  local agent="$1"
  case "$agent" in
    claude-code)
      echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
      ;;
    codex)
      echo "${CODEX_HOME:-$HOME/.codex}/skills"
      ;;
    cursor)
      echo "$HOME/.cursor/skills"
      ;;
    *)
      echo "Unsupported agent: $agent" >&2
      exit 1
      ;;
  esac
}

validate_agents() {
  local -a input=("$@")
  local a
  for a in "${input[@]}"; do
    if ! contains "$a" "${DEFAULT_AGENTS[@]}"; then
      echo "Invalid agent: $a" >&2
      echo "Valid agents: ${DEFAULT_AGENTS[*]}" >&2
      exit 1
    fi
  done
}

validate_skills() {
  local -a input=("$@")
  local s
  for s in "${input[@]}"; do
    if ! contains "$s" "${ALL_SKILLS[@]}"; then
      echo "Invalid skill: $s" >&2
      echo "Valid skills: ${ALL_SKILLS[*]}" >&2
      exit 1
    fi
    if [[ ! -d "$SKILLS_SRC_ROOT/$s" ]]; then
      echo "Missing skill directory: $SKILLS_SRC_ROOT/$s" >&2
      exit 1
    fi
  done
}

install_skill_to_agent() {
  local skill="$1"
  local agent="$2"
  local src="$SKILLS_SRC_ROOT/$skill"
  local dest_root
  dest_root="$(agent_dir "$agent")"
  local dest="$dest_root/$skill"

  mkdir -p "$dest_root"
  rm -rf "$dest"
  cp -R "$src" "$dest"
  echo "installed $skill -> $agent ($dest)"
}

uninstall_skill_from_agent() {
  local skill="$1"
  local agent="$2"
  local dest_root
  dest_root="$(agent_dir "$agent")"
  local dest="$dest_root/$skill"

  if [[ -d "$dest" ]]; then
    rm -rf "$dest"
    echo "removed $skill -> $agent"
  else
    echo "skip $skill -> $agent (not installed)"
  fi
}

list_state() {
  local -n skills_ref="$1"
  local -n agents_ref="$2"
  local agent skill dest_root dest

  for agent in "${agents_ref[@]}"; do
    dest_root="$(agent_dir "$agent")"
    echo "agent: $agent"
    echo "path:  $dest_root"
    for skill in "${skills_ref[@]}"; do
      dest="$dest_root/$skill"
      if [[ -d "$dest" ]]; then
        echo "  [installed] $skill"
      else
        echo "  [missing]   $skill"
      fi
    done
    echo
  done
}

main() {
  if [[ $# -lt 1 ]]; then
    usage
    exit 1
  fi

  if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    usage
    exit 0
  fi

  local cmd="$1"
  shift

  local -a agents=("${DEFAULT_AGENTS[@]}")
  local -a skills=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --agents)
        if [[ $# -lt 2 ]]; then
          echo "--agents requires value" >&2
          exit 1
        fi
        split_csv "$2" agents
        shift 2
        ;;
      --skills)
        if [[ $# -lt 2 ]]; then
          echo "--skills requires value" >&2
          exit 1
        fi
        split_csv "$2" skills
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        exit 1
        ;;
    esac
  done

  validate_agents "${agents[@]}"

  case "$cmd" in
    install-all)
      skills=("${ALL_SKILLS[@]}")
      ;;
    install-select)
      if [[ ${#skills[@]} -eq 0 ]]; then
        echo "install-select requires --skills" >&2
        exit 1
      fi
      ;;
    uninstall-all)
      skills=("${ALL_SKILLS[@]}")
      ;;
    uninstall-select)
      if [[ ${#skills[@]} -eq 0 ]]; then
        echo "uninstall-select requires --skills" >&2
        exit 1
      fi
      ;;
    reset)
      skills=("${ALL_SKILLS[@]}")
      ;;
    list)
      if [[ ${#skills[@]} -eq 0 ]]; then
        skills=("${ALL_SKILLS[@]}")
      fi
      ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage
      exit 1
      ;;
  esac

  validate_skills "${skills[@]}"

  local agent skill
  case "$cmd" in
    install-all|install-select)
      for agent in "${agents[@]}"; do
        for skill in "${skills[@]}"; do
          install_skill_to_agent "$skill" "$agent"
        done
      done
      ;;
    uninstall-all|uninstall-select)
      for agent in "${agents[@]}"; do
        for skill in "${skills[@]}"; do
          uninstall_skill_from_agent "$skill" "$agent"
        done
      done
      ;;
    reset)
      for agent in "${agents[@]}"; do
        for skill in "${skills[@]}"; do
          uninstall_skill_from_agent "$skill" "$agent"
        done
      done
      for agent in "${agents[@]}"; do
        for skill in "${skills[@]}"; do
          install_skill_to_agent "$skill" "$agent"
        done
      done
      ;;
    list)
      list_state skills agents
      ;;
  esac
}

main "$@"
