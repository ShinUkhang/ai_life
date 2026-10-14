/* 🐍 Pyodide 공용 코드 실행기 — ai_life 시뮬레이터용
 * 사용법: HTML에 아래 구조를 넣고 initPyodideRunner() 호출
 *
 * <div class="code-runner">
 *   <textarea id="codeEditor"></textarea>
 *   <button onclick="runPythonCode()">▶ 실행</button>
 *   <div id="codeOutput"></div>
 *   <div id="codeStatus"></div>
 * </div>
 */
let _pyodide = null;
let _pyodideLoading = false;

async function initPyodideRunner(statusId = "codeStatus") {
  const status = document.getElementById(statusId);
  if (_pyodide) return _pyodide;
  if (_pyodideLoading) return null;
  _pyodideLoading = true;
  try {
    if (status) { status.textContent = "⏳ Python 로딩 중..."; status.style.color = "#888"; }
    _pyodide = await loadPyodide();
    await _pyodide.loadPackage("numpy");
    await _pyodide.loadPackage("matplotlib");
    if (status) { status.textContent = "✅ Python 준비 완료!"; status.style.color = "#27ae60"; }
    _pyodideLoading = false;
    return _pyodide;
  } catch (e) {
    if (status) { status.textContent = "❌ 로딩 실패: " + e.message; status.style.color = "#e74c3c"; }
    _pyodideLoading = false;
    return null;
  }
}

async function runPythonCode(editorId = "codeEditor", outputId = "codeOutput", statusId = "codeStatus") {
  const output = document.getElementById(outputId);
  const code = document.getElementById(editorId).value;
  if (!_pyodide) {
    output.textContent = "⏳ Python이 아직 로딩 중입니다. 잠시 후 다시 눌러주세요.";
    await initPyodideRunner(statusId);
    return;
  }
  output.textContent = "▶ 실행 중...\n";
  try {
    _pyodide.setStdout({ batched: (s) => { output.textContent += s + "\n"; } });
    _pyodide.setStderr({ batched: (s) => { output.textContent += "⚠️ " + s + "\n"; } });
    await _pyodide.runPythonAsync(code);
    output.textContent += "\n✅ 실행 완료!";
  } catch (e) {
    // matplotlib 그림이 있으면 표시
    output.textContent += "\n❌ 오류:\n" + (e.message || e);
  }
  output.scrollTop = output.scrollHeight;
}

function copyRunnerCode(editorId = "codeEditor") {
  const code = document.getElementById(editorId).value;
  navigator.clipboard.writeText(code).then(() => alert("📋 코드가 복사되었습니다!"));
}

function resetRunnerCode(editorId, starterCode) {
  document.getElementById(editorId).value = starterCode;
}
