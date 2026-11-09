#!/bin/sh
# Sandbox tests for wanstats-collect and the rpcd plugin.
# Uses a fake sysfs counter tree and fixed epochs (WANSTATS_EPOCH test hook).
# Run: sh tests/run-tests.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COLLECT="$ROOT/root/usr/sbin/wanstats-collect"
RPCD="$ROOT/root/usr/libexec/rpcd/wanstats"

T="$(mktemp -d)"
trap 'rm -rf "$T"' 0 INT TERM

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "ok   - $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL - $1"; }
check() { # $1 description, $2 expected, $3 actual
	if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected [$2], got [$3])"; fi
}

epoch() { date -u -d "$1" +%s; }

# ---------- fixture helpers ----------
SYS="$T/sys"; DEV="testwan"
mkdir -p "$SYS/$DEV/statistics"
set_counters() { printf '%s' "$1" > "$SYS/$DEV/statistics/rx_bytes"; printf '%s' "$2" > "$SYS/$DEV/statistics/tx_bytes"; }

run_collect() { # $1=data_dir $2=epoch
	WANSTATS_DATA_DIR="$1" WANSTATS_DEV="$DEV" WANSTATS_SYSFS="$SYS" \
	WANSTATS_EPOCH="$2" sh "$COLLECT"
}

GIB=1073741824; M512=536870912

# ---------- 1. first pass = baseline, zero row ----------
D1="$T/data1"
set_counters 1000 2000
run_collect "$D1" "$(epoch '2026-02-03 12:00:00')" || bad "collect exit (baseline)"
check "baseline creates zero row" "2026-02-03,0,0" "$(cat "$D1/daily.csv")"

# ---------- 2. delta accumulates into today ----------
set_counters $((1000+GIB)) $((2000+M512))
run_collect "$D1" "$(epoch '2026-02-03 12:01:00')"
check "delta accumulates" "2026-02-03,$GIB,$M512" "$(cat "$D1/daily.csv")"

# ---------- 3. same day keeps summing ----------
set_counters $((1000+GIB+100)) $((2000+M512+50))
run_collect "$D1" "$(epoch '2026-02-03 23:59:00')"
check "same day sums" "2026-02-03,$((GIB+100)),$((M512+50))" "$(cat "$D1/daily.csv")"

# ---------- 4. next day = new row ----------
set_counters $((1000+GIB+100+1000)) $((2000+M512+50+1000))
run_collect "$D1" "$(epoch '2026-02-04 00:01:00')"
check "two daily rows" "2026-02-03,$((GIB+100)),$((M512+50))
2026-02-04,1000,1000" "$(cat "$D1/daily.csv")"

# ---------- 5. counter reset (reboot/redial): delta = counter itself ----------
set_counters 500 300
run_collect "$D1" "$(epoch '2026-02-04 00:02:00')"
check "reset counts traffic since reset" "2026-02-03,$((GIB+100)),$((M512+50))
2026-02-04,1500,1300" "$(cat "$D1/daily.csv")"

# ---------- 6. clock not set: baseline only, no 1970 booking ----------
D2="$T/data2"
set_counters 5000 5000
run_collect "$D2" 100000	# 1970-01-02, before NTP
if [ -f "$D2/daily.csv" ]; then bad "invalid time must not create daily.csv"; else ok "invalid time creates no history"; fi
set_counters 6000 7000
run_collect "$D2" "$(epoch '2026-02-03 08:00:00')"
check "pre-NTP bytes excluded, later delta counted" "2026-02-03,1000,2000" "$(cat "$D2/daily.csv")"

# ---------- 7. pruning: retention 13 months, cutoff = 2025-02-01 for 2026-02 ----------
D3="$T/data3"; mkdir -p "$D3"
printf '2025-01-15,111,222\n2025-02-01,333,444\n2025-02-28,555,666\n' > "$D3/daily.csv"
set_counters 10 20
run_collect "$D3" "$(epoch '2026-02-03 10:00:00')"
check "13-month prune keeps boundary month" "2025-02-01,333,444
2025-02-28,555,666
2026-02-03,0,0" "$(cat "$D3/daily.csv")"

# ---------- 8. pruning across year boundary: today 2026-01-31 -> cutoff 2025-01-01 ----------
D4="$T/data4"; mkdir -p "$D4"
printf '2024-12-31,1,1\n2025-01-01,2,2\n' > "$D4/daily.csv"
run_collect "$D4" "$(epoch '2026-01-31 10:00:00')"
check "year-boundary prune" "2025-01-01,2,2
2026-01-31,0,0" "$(cat "$D4/daily.csv")"

# ---------- 8b. selection=dev:<name> counts that device, not the default one ----------
SYS2="$T/sys2"; DEV2="otherwan"
mkdir -p "$SYS2/$DEV2/statistics" "$SYS2/$DEV/statistics"
printf '100' > "$SYS2/$DEV/statistics/rx_bytes"; printf '100' > "$SYS2/$DEV/statistics/tx_bytes"
printf '5000' > "$SYS2/$DEV2/statistics/rx_bytes"; printf '6000' > "$SYS2/$DEV2/statistics/tx_bytes"
D5="$T/data5"
WANSTATS_DATA_DIR="$D5" WANSTATS_SYSFS="$SYS2" WANSTATS_SELECTION="dev:$DEV2" \
WANSTATS_EPOCH="$(epoch '2026-02-05 09:00:00')" sh "$COLLECT"
printf '8000' > "$SYS2/$DEV2/statistics/rx_bytes"; printf '9000' > "$SYS2/$DEV2/statistics/tx_bytes"
WANSTATS_DATA_DIR="$D5" WANSTATS_SYSFS="$SYS2" WANSTATS_SELECTION="dev:$DEV2" \
WANSTATS_EPOCH="$(epoch '2026-02-05 09:01:00')" sh "$COLLECT"
check "selection dev: counts selected device" "2026-02-05,3000,3000" "$(cat "$D5/daily.csv")"
check "selection dev: state records device" "$DEV2" "$(cut -d' ' -f1 "$D5/state")"

# ---------- 8c. rpcd get_options: devices from sysfs, valid JSON ----------
echo '{}' | WANSTATS_SYSFS="$SYS2" sh "$RPCD" call get_options | python3 -c '
import json, sys
d = json.load(sys.stdin)
assert "otherwan" in d["devices"] and "testwan" in d["devices"], d
assert isinstance(d["interfaces"], list), d
' && ok "rpcd get_options JSON + devices" || bad "rpcd get_options JSON + devices"

# ---------- 9. rpcd get_history: daily + derived monthly as valid JSON ----------
OUT="$(echo '{}' | WANSTATS_DATA_DIR="$D1" sh "$RPCD" call get_history)"
echo "$OUT" | python3 -c '
import json, sys
d = json.load(sys.stdin)
assert d["device"] == "testwan", d
assert [r["date"] for r in d["daily"]] == ["2026-02-04", "2026-02-03"], d
feb = [r for r in d["monthly"] if r["month"] == "2026-02"]
assert len(feb) == 1, d
assert feb[0]["rx"] == 1073741824 + 100 + 1500, feb
assert feb[0]["tx"] == 536870912 + 50 + 1300, feb
' && ok "rpcd get_history JSON + monthly sums" || bad "rpcd get_history JSON + monthly sums"

# ---------- 10. rpcd list / get_status ----------
echo '{}' | WANSTATS_DATA_DIR="$D1" sh "$RPCD" list | grep -q get_history && ok "rpcd list" || bad "rpcd list"
echo '{}' | WANSTATS_DATA_DIR="$D1" sh "$RPCD" call get_status | grep -q '"device":"testwan"' && ok "rpcd get_status" || bad "rpcd get_status"

# ---------- 11. static checks ----------
for f in "$COLLECT" "$ROOT/root/usr/sbin/wanstatsd" "$ROOT/root/etc/init.d/wanstats" "$RPCD"; do
	sh -n "$f" && ok "sh -n $f" || bad "sh -n $f"
done
python3 -m json.tool "$ROOT/root/usr/share/rpcd/acl.d/luci-app-bandwidthd.json" >/dev/null && ok "acl json valid" || bad "acl json valid"
python3 -m json.tool "$ROOT/root/usr/share/luci/menu.d/luci-app-bandwidthd.json" >/dev/null && ok "menu json valid" || bad "menu json valid"
if command -v node >/dev/null 2>&1; then
	for j in "$ROOT"/htdocs/luci-static/resources/view/bandwidthd/*.js; do
		node --check "$j" && ok "node --check $j" || bad "node --check $j"
	done
else
	echo "skip - node not available, JS syntax not checked"
fi

echo "----------------------------------------"
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" = 0 ]
