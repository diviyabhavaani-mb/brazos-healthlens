# Convenience targets. The dashboard needs no build: open index.html.
.PHONY: data download topology build survey test serve
data: download topology build survey
download: ; cd pipeline && python download.py
topology: ; cd pipeline && python build_topology.py
build:    ; cd pipeline && python build_data.py
survey:   ; cd pipeline && python survey_summary.py
test:     ; python tests/test_pipeline.py && python tests/smoke_test.py
serve:    ; python -m http.server 8000
