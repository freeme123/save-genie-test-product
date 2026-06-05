#!/usr/bin/env bash
# Trigger an on-demand price/availability change, then watch the deploy.
#
# Usage:
#   ./trigger.sh drop          # lower price by $10
#   ./trigger.sh raise         # raise price by $10
#   ./trigger.sh toggle        # flip in/out of stock
#   ./trigger.sh instock       # force In stock
#   ./trigger.sh outofstock    # force Out of stock
#   ./trigger.sh reset         # back to automatic clock mode
#
# Requires the `gh` CLI authenticated with `workflow` scope.

set -euo pipefail

WORKFLOW="Rotate price & deploy"

case "${1:-}" in
  drop)        cmd=drop ;;
  raise)       cmd=raise ;;
  toggle)      cmd=toggle_stock ;;
  instock)     cmd=set_instock ;;
  outofstock|oos) cmd=set_outofstock ;;
  reset|auto)  cmd=reset ;;
  *)
    echo "usage: ./trigger.sh {drop|raise|toggle|instock|outofstock|reset}" >&2
    exit 1 ;;
esac

echo "Triggering '$cmd'..."
gh workflow run "$WORKFLOW" -f command="$cmd"

# Give GitHub a moment to register the run, then watch it.
sleep 5
run_id="$(gh run list --workflow="$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$run_id" --exit-status || true

echo
echo "Done. Live page: https://freeme123.github.io/save-genie-test-product/"
