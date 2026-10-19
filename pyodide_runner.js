/* 🐍 Pyodide 공용 코드 실행기 — ai_life 시뮬레이터용 (v2)
 *
 * HTML 구조(기존 페이지와 호환):
 *   <textarea id="codeEditor"></textarea>
 *   <button onclick="runPythonCode()">▶ 실행</button>
 *   <div id="codeStatus"></div>
 *   <div id="codeOutput"></div>
 *
 * v2에서 달라진 점
 *  - plt.show() 그래프가 출력창 바로 아래에 이미지로 나타납니다.
 *  - numpy / matplotlib / pandas / scipy 는 코드에 import가 있을 때만 불러옵니다(첫 로딩이 가벼움).
 *  - input() 을 쓰면 입력 창이 뜹니다.
 *  - 오류가 나면 "몇 번째 줄, 어떤 종류의 오류인지"를 한국어 힌트로 알려줍니다.
 *  - 맨 위의 대문자 변수(예: LEARNING_RATE = 0.01)를 바꿀 때마다
 *    [🧪 변수 실험 기록표]에 "바꾼 값 → 결과"가 한 줄씩 쌓여 비교할 수 있습니다.
 *  - Tab 키 = 들여쓰기 4칸, Ctrl(⌘)+Enter = 실행
 */
let _pyodide = null;
let _pyodideLoading = null;
const _pyLoaded = new Set();
var _runHistory = {};   // editorId -> [{vars, result, ok}] (window._runHistory 로도 읽을 수 있음)

const _PY_BOOT = `
import io, sys, os, base64, traceback, warnings
os.environ["MPLBACKEND"] = "Agg"
warnings.filterwarnings("ignore", message=".*non-interactive.*")
warnings.filterwarnings("ignore", message=".*Glyph.*missing.*")
from contextlib import redirect_stdout, redirect_stderr

def __ai_run__(user_code):
    out, err = io.StringIO(), io.StringIO()
    figs = []
    has_mpl = "matplotlib" in sys.modules
    if has_mpl:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        plt.close("all")
    def __input(prompt=""):
        from js import window
        out.write(str(prompt))
        v = window.prompt(str(prompt) or "입력값을 적어주세요")
        if v is None:
            raise EOFError("입력을 취소했어요.")
        out.write(str(v) + "\\n")
        return str(v)
    ns = {"__name__": "__main__", "input": __input}
    ok = True
    try:
        with redirect_stdout(out), redirect_stderr(err):
            exec(compile(user_code, "<내 코드>", "exec"), ns)
    except SystemExit as e:
        if e.code not in (None, 0):
            out.write("\n⏹ " + str(e.code) + "\n")
    except BaseException:
        ok = False
        etype, evalue, tb = sys.exc_info()
        line = None
        if isinstance(evalue, SyntaxError):
            line = evalue.lineno
        else:
            for fr in traceback.extract_tb(tb):
                if fr.filename == "<내 코드>":
                    line = fr.lineno
        msg = "".join(traceback.format_exception_only(etype, evalue)).strip()
        err.write("__AIERR__|" + etype.__name__ + "|" + str(line or "") + "|" + msg)
    if "matplotlib" in sys.modules:
        import matplotlib.pyplot as plt
        for n in plt.get_fignums():
            buf = io.BytesIO()
            plt.figure(n).savefig(buf, format="png", bbox_inches="tight", dpi=110)
            figs.append(base64.b64encode(buf.getvalue()).decode("ascii"))
        plt.close("all")
    return out.getvalue(), err.getvalue(), figs, ok
`;

const _ERR_HINTS = {
  SyntaxError: "문법 오류예요. 따옴표·괄호 짝, 콜론(:) 빠짐, 한글/영문 기호 섞임을 확인해 보세요.",
  IndentationError: "들여쓰기 오류예요. for/if/def 아래 줄은 같은 칸(보통 4칸)만큼 들여써야 해요.",
  TabError: "탭과 스페이스가 섞였어요. 들여쓰기를 스페이스 4칸으로 통일해 보세요.",
  NameError: "없는 이름(변수/함수)을 썼어요. 철자, 대소문자, 그리고 그 변수를 위에서 먼저 만들었는지 확인해 보세요.",
  TypeError: "자료형이 맞지 않아요. 예: 문자열 + 숫자 → str()이나 int()로 바꿔서 계산해 보세요.",
  ValueError: "값이 알맞지 않아요. 예: int('abc')처럼 숫자로 바꿀 수 없는 값을 넣었는지 확인해 보세요.",
  IndexError: "리스트/배열의 범위를 벗어났어요. 인덱스는 0부터 시작하고 길이-1까지만 쓸 수 있어요.",
  KeyError: "딕셔너리에 없는 키를 찾았어요. 키 이름을 확인해 보세요.",
  ZeroDivisionError: "0으로 나눴어요. 분모가 0이 되는 경우가 있는지 확인해 보세요.",
  ModuleNotFoundError: "이 실행기에 없는 라이브러리예요. numpy, matplotlib, pandas, scipy 정도만 쓸 수 있어요(나머지는 코랩에서).",
  OverflowError: "숫자가 너무 커졌어요(발산). 학습률 같은 값을 더 작게 해 보세요.",
  AttributeError: "그 객체에는 없는 기능(속성/메서드)을 불렀어요. 철자를 확인해 보세요.",
  EOFError: "input() 입력이 취소됐어요. 다시 실행하고 값을 입력해 주세요.",
};

function _injectRunnerStyle() {
  if (document.getElementById("_pyrunner_style")) return;
  const st = document.createElement("style");
  st.id = "_pyrunner_style";
  st.textContent = `
  .pyr-plots{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
  .pyr-plots img{max-width:100%;background:#fff;border:1px solid #e5e8eb;border-radius:8px}
  .pyr-err{color:#ff8a80}
  .pyr-hint{display:block;margin-top:8px;padding:10px 12px;background:#fff4e5;color:#7a4b00;border-radius:8px;font-family:Pretendard,system-ui,sans-serif;font-size:13px;line-height:1.55;white-space:normal}
  .pyr-hist{margin-top:12px;font-family:Pretendard,system-ui,sans-serif;font-size:13px;background:#fff;color:#191f28;border:1px solid #e5e8eb;border-radius:10px;overflow:hidden}
  .pyr-hist-h{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f2f4f6;font-weight:700}
  .pyr-hist-h button{font:inherit;font-size:12px;font-weight:600;border:0;background:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;color:#4e5968}
  .pyr-hist-wrap{overflow-x:auto}
  .pyr-hist table{border-collapse:collapse;width:100%;min-width:420px}
  .pyr-hist th,.pyr-hist td{padding:6px 10px;border-top:1px solid #f2f4f6;text-align:left;vertical-align:top}
  .pyr-hist th{font-size:12px;color:#6b7684;font-weight:600}
  .pyr-hist td.v{font-family:ui-monospace,Consolas,monospace;white-space:nowrap}
  .pyr-hist td.chg{background:#fff8d6;font-weight:700}
  .pyr-hist .q{padding:8px 12px;color:#4e5968;border-top:1px solid #f2f4f6;line-height:1.5}
  .pyr-line-hl{outline:2px solid #ff8a80}
  `;
  document.head.appendChild(st);
}

function _escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _setStatus(statusId, text, color) {
  const el = document.getElementById(statusId);
  if (el) { el.textContent = text; if (color) el.style.color = color; }
}

function _enhanceEditor(editorId, outputId, statusId) {
  const ed = document.getElementById(editorId);
  if (!ed || ed.dataset.pyrEnhanced) return;
  ed.dataset.pyrEnhanced = "1";
  ed.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = ed.selectionStart;
      ed.value = ed.value.slice(0, s) + "    " + ed.value.slice(ed.selectionEnd);
      ed.selectionStart = ed.selectionEnd = s + 4;
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runPythonCode(editorId, outputId, statusId);
    }
  });
}

async function initPyodideRunner(statusId = "codeStatus", editorId = "codeEditor", outputId = "codeOutput") {
  _injectRunnerStyle();
  _enhanceEditor(editorId, outputId, statusId);
  if (_pyodide) return _pyodide;
  if (_pyodideLoading) return _pyodideLoading;
  _setStatus(statusId, "⏳ Python 준비 중... (처음 한 번만 조금 걸려요)", "#8b95a1");
  _pyodideLoading = (async () => {
    try {
      if (typeof loadPyodide !== "function") throw new Error("Pyodide 스크립트를 불러오지 못했어요 (인터넷 연결 확인)");
      const py = await loadPyodide();
      await py.runPythonAsync(_PY_BOOT);
      _pyodide = py;
      _setStatus(statusId, "✅ Python 준비 완료! 변수를 바꾸고 ▶ 실행 (Ctrl+Enter)", "#12a150");
      return py;
    } catch (e) {
      _setStatus(statusId, "❌ Python 로딩 실패: " + e.message + " — 새로고침 해 보세요", "#e5484d");
      _pyodideLoading = null;
      return null;
    }
  })();
  return _pyodideLoading;
}

function _detectPackages(code) {
  const map = { numpy: "numpy", matplotlib: "matplotlib", pandas: "pandas", scipy: "scipy", sklearn: "scikit-learn" };
  const need = new Set();
  const re = /^\s*(?:import|from)\s+([A-Za-z_][\w]*)/gm;
  let m;
  while ((m = re.exec(code))) if (map[m[1]]) need.add(map[m[1]]);
  return [...need].filter((p) => !_pyLoaded.has(p));
}

// 맨 위쪽의 "대문자 변수 = 값" 줄을 실험 변수로 봅니다. 여러 줄에 걸친 [ ] 리스트도 한 덩어리로 읽어요.
function _readExperimentVars(code) {
  const vars = [];
  const lines = code.split("\n");
  const bal = (t) => (t.match(/[\[({]/g) || []).length - (t.match(/[\])}]/g) || []).length;
  for (let i = 0; i < lines.length && vars.length < 6; i++) {
    const m = lines[i].match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/);
    if (!m || vars.find((v) => v[0] === m[1])) continue;
    let val = m[2].replace(/\s+#.*$/, "").trim();
    const tq = val.match(/^[rbuf]?("""|\'\'\')/i);
    if (tq) {                                   // 여러 줄 글 TEXT = """ ... """
      let body = val.slice(tq[0].length);
      while (!body.includes(tq[1]) && i + 1 < lines.length) { i++; body += "\n" + lines[i]; }
      body = body.split(tq[1])[0];
      vars.push([m[1], `"""글 ${body.trim().length}자"""`, body]);
      continue;
    }
    let depth = bal(val);
    while (depth > 0 && i + 1 < lines.length) {
      i++;
      const part = lines[i].replace(/\s+#.*$/, "").trim();
      val += part; depth += bal(part);
    }
    val = val.replace(/\s+/g, " ");
    const shown = val.length > 28 ? val.slice(0, 26) + "…" : val;
    vars.push([m[1], shown, val]);
  }
  return vars;
}

// 결과 칸에는 "💡 바꿔 보세요" 같은 안내 줄을 빼고, 마지막 결과 줄을 보여 줘요.
function _lastLine(text) {
  const lines = String(text).split("\n").map((s) => s.trim()).filter(Boolean)
    .filter((l) => !/^(💡|👉|※|\d+\.\s)/.test(l) && !/보세요[!.]?$/.test(l) && !/^[=\-─]{3,}$/.test(l));
  const l = lines.length ? lines[lines.length - 1] : "(출력 없음)";
  return l.length > 70 ? l.slice(0, 68) + "…" : l;
}

function _renderHistory(editorId, anchorEl) {
  const hist = _runHistory[editorId] || [];
  let box = document.getElementById("_pyr_hist_" + editorId);
  if (!hist.length || !hist[0].vars.length) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement("div");
    box.id = "_pyr_hist_" + editorId;
    box.className = "pyr-hist";
    anchorEl.insertAdjacentElement("afterend", box);
  }
  const names = [];
  hist.forEach((h) => h.vars.forEach(([k]) => { if (!names.includes(k)) names.push(k); }));
  let rows = "";
  hist.forEach((h, i) => {
    const prev = hist[i - 1];
    const cells = names.map((k) => {
      const cur = h.vars.find((x) => x[0] === k) || [k, "-", "-"];
      const pr = prev ? (prev.vars.find((x) => x[0] === k) || [k, "-", "-"]) : cur;
      return `<td class="v${prev && (pr[2] || pr[1]) !== (cur[2] || cur[1]) ? " chg" : ""}" title="${_escHtml(cur[2] || cur[1])}">${_escHtml(cur[1])}</td>`;
    }).join("");
    rows += `<tr><td>${i + 1}</td>${cells}<td>${h.ok ? "" : "❌ "}${_escHtml(h.result)}</td></tr>`;
  });
  box.innerHTML = `<div class="pyr-hist-h"><span>🧪 변수 실험 기록표 <small style="font-weight:500;color:#8b95a1">(노란 칸 = 이번에 바꾼 값)</small></span>
      <button type="button" onclick="_clearRunHistory('${editorId}')">기록 지우기</button></div>
    <div class="pyr-hist-wrap"><table><thead><tr><th>#</th>${names.map((n) => `<th>${_escHtml(n)}</th>`).join("")}<th>결과 (마지막 출력)</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="q">💭 <b>생각해 보기</b> — 값을 <b>하나만</b> 바꿨을 때 결과가 어떻게 달라졌나요? 실행하기 <b>전에</b> 결과를 먼저 예측해 보세요.</div>`;
}

function _clearRunHistory(editorId) {
  _runHistory[editorId] = [];
  const box = document.getElementById("_pyr_hist_" + editorId);
  if (box) box.remove();
}

async function runPythonCode(editorId = "codeEditor", outputId = "codeOutput", statusId = "codeStatus") {
  _injectRunnerStyle();
  const output = document.getElementById(outputId);
  const editor = document.getElementById(editorId);
  if (!output || !editor) return;
  const code = editor.value;
  output.textContent = "⏳ Python 준비 중...";
  const py = await initPyodideRunner(statusId, editorId, outputId);
  if (!py) { output.textContent = "❌ Python을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침 해 주세요."; return; }

  let plots = document.getElementById("_pyr_plots_" + outputId);
  if (!plots) {
    plots = document.createElement("div");
    plots.id = "_pyr_plots_" + outputId;
    plots.className = "pyr-plots";
    output.insertAdjacentElement("afterend", plots);
  }
  plots.innerHTML = "";

  try {
    const need = _detectPackages(code);
    if (need.length) {
      output.textContent = "📦 " + need.join(", ") + " 불러오는 중... (처음 한 번만)";
      await py.loadPackage(need);
      need.forEach((p) => _pyLoaded.add(p));
      if (need.includes("matplotlib")) await py.runPythonAsync('import matplotlib\nmatplotlib.use("Agg")');
    }
    output.textContent = "▶ 실행 중...";
    const t0 = performance.now();
    py.globals.set("__ai_code__", code);
    const res = await py.runPythonAsync("__ai_run__(__ai_code__)");
    const [stdout, stderr, figs, ok] = res.toJs();
    res.destroy && res.destroy();
    const ms = Math.round(performance.now() - t0);

    let html = stdout ? _escHtml(stdout) : "";
    let errLine = null;
    if (stderr) {
      const idx = stderr.indexOf("__AIERR__|");
      const warn = idx >= 0 ? stderr.slice(0, idx) : stderr;
      if (warn.trim()) html += `<span class="pyr-err">${_escHtml(warn)}</span>`;
      if (idx >= 0) {
        const [, etype, line, ...rest] = stderr.slice(idx).split("|");
        errLine = line ? parseInt(line, 10) : null;
        const lineTxt = errLine ? ` (${errLine}번째 줄)` : "";
        const codeLine = errLine ? code.split("\n")[errLine - 1] : "";
        html += `<span class="pyr-err">\n❌ ${_escHtml(etype)}${lineTxt}\n${_escHtml(rest.join("|"))}${codeLine ? "\n   → " + _escHtml(codeLine.trim()) : ""}</span>`;
        html += `<span class="pyr-hint">💡 ${_escHtml(_ERR_HINTS[etype] || "오류 메시지의 마지막 줄을 읽어 보고, 표시된 줄 근처를 확인해 보세요.")}</span>`;
      }
    }
    if (!html) html = "(출력 없음 — print()로 값을 출력해 보세요)";
    if (ok) html += `\n<span style="color:#7ee2a8">✅ 실행 완료 (${ms}ms)</span>`;
    output.innerHTML = html;
    output.scrollTop = 0;

    figs.forEach((b64) => {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + b64;
      img.alt = "실행 결과 그래프";
      plots.appendChild(img);
    });

    if (errLine) _selectLine(editor, errLine);

    const vars = _readExperimentVars(code);
    if (vars.length) {
      (_runHistory[editorId] = _runHistory[editorId] || []).push({
        vars, ok, result: ok ? _lastLine(stdout) : "오류: " + (stderr.split("|")[1] || ""),
      });
      if (_runHistory[editorId].length > 12) _runHistory[editorId].shift();
      _renderHistory(editorId, plots);
    }
  } catch (e) {
    output.innerHTML = `<span class="pyr-err">실행기 오류: ${_escHtml(e.message || e)}</span>`;
  }
}

function _selectLine(editor, lineNo) {
  const lines = editor.value.split("\n");
  if (lineNo < 1 || lineNo > lines.length) return;
  let start = 0;
  for (let i = 0; i < lineNo - 1; i++) start += lines[i].length + 1;
  try { editor.focus({ preventScroll: true }); editor.setSelectionRange(start, start + lines[lineNo - 1].length); } catch (e) {}
}

function copyRunnerCode(editorId = "codeEditor") {
  const code = document.getElementById(editorId).value;
  const done = () => alert("📋 코드가 복사되었습니다! 코랩에 붙여넣어 실행해 보세요.");
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(code).then(done, () => _fallbackCopy(code, done));
  } else _fallbackCopy(code, done);
}

function _fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { alert("복사에 실패했어요. 직접 선택해서 복사해 주세요."); }
  ta.remove();
}

function resetRunnerCode(editorId, starterCode) {
  if (starterCode === undefined) return;
  const ed = document.getElementById(editorId);
  if (ed.value !== starterCode && !confirm("처음 코드로 되돌릴까요? (지금 고친 내용은 사라져요)")) return;
  ed.value = starterCode;
}
