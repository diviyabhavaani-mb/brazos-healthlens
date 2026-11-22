# Convenience targets. The dashboard needs no build: open index.html or run `make serve`.
.PHONY: data refresh download topology build check survey feedback test serve
data: download topology build survey feedback
refresh:  ; cp data/healthlens_data.js /tmp/old_data.js && cd pipeline && python download.py --force --latest && python build_topology.py && python build_data.py && python check_data.py --old /tmp/old_data.js --label "local refresh"
download: ; cd pipeline && python download.py
topology: ; cd pipeline && python build_topology.py
build:    ; cd pipeline && python build_data.py
check:    ; cd pipeline && python check_data.py --old ../data/healthlens_data.js --label "self-check"
survey:   ; cd pipeline && python survey_summary.py
feedback: ; python pipeline/feedback_summary.py
test:     ; python tests/test_pipeline.py && python tests/smoke_test.py
serve:    ; python -m http.server 8000
