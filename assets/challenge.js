/* 심화 과제 도전실 — 엔진
 * 파이썬 실행기(Web Worker + Pyodide, 무한 반복은 6초 뒤 자동 중지), 오류 풀이,
 * 실행 전 오류 미리 검사(lint), 단계별 자동 확인, 코드 에디터
 */
(function () {
  const PC = {};
  window.PC = PC;
  PC.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  PC.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- 파이썬 실행기 (Web Worker + Pyodide) ---------- */
  const PYODIDE = window.CHALLENGE_PYODIDE_URL || "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  const WORKER_SRC = `
importScripts("${PYODIDE}pyodide.js");
const BOOT = ${JSON.stringify(`
import io, sys, traceback
def __run__(user_code, stdin_text):
    out = io.StringIO()
    lines = iter(stdin_text.splitlines())
    def _input(prompt=""):
        out.write(str(prompt))
        try:
            v = next(lines)
        except StopIteration:
            raise EOFError("__NEED_INPUT__")
        out.write(v + "\\n")
        return v
    ns = {"__name__": "__main__", "input": _input}
    etype = emsg = ""
    eline = 0
    old = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    try:
        exec(compile(user_code, "<코드>", "exec"), ns)
    except BaseException as e:
        etype = type(e).__name__
        emsg = str(e)
        if isinstance(e, SyntaxError) and e.lineno:
            eline = e.lineno
        else:
            fr = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "<코드>"]
            eline = fr[-1].lineno if fr else 0
    finally:
        sys.stdout, sys.stderr = old
    text = out.getvalue()
    if len(text) > 20000:
        text = text[:20000] + "\\n... (출력이 너무 길어 잘랐어요)"
    return [text, etype, emsg, eline]
`)};
let py;
const ready = loadPyodide({ indexURL: "${PYODIDE}" }).then(async (p) => { py = p; await py.runPythonAsync(BOOT); postMessage({ ready: true }); }).catch((e) => postMessage({ fail: String(e) }));
onmessage = async (e) => {
  await ready;
  const { id, code, stdin } = e.data;
  try {
    py.globals.set("__c", code); py.globals.set("__s", stdin || "");
    const r = py.runPython("__run__(__c, __s)").toJs();
    postMessage({ id, out: r[0], etype: r[1], emsg: r[2], eline: r[3] });
  } catch (err) { postMessage({ id, out: "", etype: "실행기 오류", emsg: String(err), eline: 0 }); }
};`;
  let worker = null, wReady = null, pending = {}, onStatus = () => {};
  PC.onRunnerStatus = (fn) => { onStatus = fn; };
  function boot() {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    worker = new Worker(url);
    onStatus("loading");
    wReady = new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        const d = e.data;
        if (d.ready) { onStatus("ready"); resolve(); return; }
        if (d.fail) { onStatus("fail", d.fail); reject(new Error(d.fail)); return; }
        const p = pending[d.id]; if (p) { delete pending[d.id]; p(d); }
      };
      worker.onerror = (e) => { onStatus("fail", e.message); reject(e); };
    });
    return wReady;
  }
  PC.bootRunner = () => wReady || boot();
  PC.run = async (code, stdin, timeoutMs) => {
    if (!worker) boot();
    await wReady;
    const id = PC.uid();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        delete pending[id];
        worker.terminate(); worker = null; wReady = null; boot();
        resolve({ out: "", etype: "시간 초과", emsg: "", eline: 0, timeout: true });
      }, timeoutMs || 6000);
      pending[id] = (d) => { clearTimeout(timer); resolve(d); };
      worker.postMessage({ id, code, stdin: stdin || "" });
    });
  };

  const ERR_TIPS = {
    SyntaxError: "문법 오류예요. 괄호·따옴표 짝, 줄 끝의 콜론(:)을 확인해요.",
    IndentationError: "들여쓰기 오류예요. if·for·def 다음 줄은 4칸(Tab) 들여써요.",
    TabError: "Tab과 스페이스가 섞였어요. 들여쓰기를 한 가지로 맞춰요.",
    NameError: "이름 오류예요. 변수·함수 이름의 철자를 확인하고, 쓰기 전에 먼저 만들었는지 봐요.",
    TypeError: "자료형 오류예요. 문자열과 숫자를 바로 계산했는지 확인해요. input()의 결과는 문자열이에요.",
    ValueError: "값 오류예요. int()나 float()에 숫자가 아닌 글자가 들어갔는지 확인해요.",
    ZeroDivisionError: "0으로 나누었어요. 나누는 수가 0이 되는 경우를 따로 처리해요.",
    IndexError: "리스트 범위를 벗어났어요. 인덱스는 0부터 시작하고, 마지막은 len()-1 이에요.",
    KeyError: "딕셔너리에 없는 키를 찾았어요. in 으로 먼저 확인해 보세요.",
    AttributeError: "그 자료형에는 없는 기능(메서드)을 불렀어요. 점(.) 뒤의 이름을 확인해요.",
    ModuleNotFoundError: "이 실행기에 없는 모듈이에요. 수업에서 배운 모듈(random 등)을 써 보세요.",
    RecursionError: "함수가 자기 자신을 끝없이 불렀어요. 멈추는 조건을 확인해요.",
    EOFError: "input()이 값을 더 기다려요. '입력값' 칸에 한 줄에 하나씩 적어 주세요.",
    "시간 초과": "6초 안에 끝나지 않아 멈췄어요. while문의 조건이 언젠가 거짓이 되는지 확인해요."
  };
  PC.explain = (r) => {
    if (!r.etype) return "";
    if (r.etype === "EOFError" && r.emsg === "__NEED_INPUT__") return ERR_TIPS.EOFError;
    return ERR_TIPS[r.etype] || "코드 실행 중 오류가 났어요. 오류가 난 줄을 확인해요.";
  };
  PC.errLine = (r) => {
    if (!r.etype) return "";
    if (r.etype === "EOFError" && r.emsg === "__NEED_INPUT__") return "EOFError: 입력값이 부족해요";
    if (r.timeout) return "시간 초과";
    return `${r.etype}${r.emsg ? ": " + r.emsg : ""}${r.eline ? ` (${r.eline}번째 줄)` : ""}`;
  };

  /* ---------- 출력 판정 ---------- */
  PC.judge = (test, r) => {
    const out = r.out || "";
    const needInput = r.etype === "EOFError" && r.emsg === "__NEED_INPUT__";
    if (r.etype && !(test.eofOk && needInput)) return { ok: false, msg: PC.errLine(r) };
    for (const s of test.expect || []) if (!out.includes(s)) return { ok: false, msg: `출력에 '${s}'가 보이지 않아요` };
    for (const s of test.notExpect || []) if (out.includes(s)) return { ok: false, msg: `출력에 '${s}'가 있으면 안 돼요` };
    for (const re of test.expectRe || []) if (!new RegExp(re, "m").test(out)) return { ok: false, msg: "출력 형식이나 값이 예상과 달라요" };
    if (test.numRange) {
      const m = out.match(new RegExp(test.numRange.re));
      const v = m ? parseFloat(m[1]) : NaN;
      if (!(v >= test.numRange.min && v <= test.numRange.max)) return { ok: false, msg: isNaN(v) ? "결과 숫자를 찾지 못했어요" : `${v}는 ${test.numRange.min}~${test.numRange.max} 범위 밖이에요` };
    }
    return { ok: true, msg: "" };
  };
  /* ---------- 단계별 자동 확인 ---------- */
  const noComment = (code) => code.replace(/#[^\n]*/g, "");
  PC.checkCode = (step, code) => {
    const items = [];
    const c = noComment(code);
    (step.codeMust || []).forEach((r) => items.push({ name: r.msg, ok: new RegExp(r.re).test(c), code: true }));
    (step.codeMustNot || []).forEach((r) => items.push({ name: r.msg, ok: !new RegExp(r.re).test(c), code: true }));
    return items;
  };
  PC.runStep = async (step, code, stdin) => {
    const items = [];
    if (step.free) {
      const r = await PC.run(code, stdin || "");
      const changed = noComment(code).trim().length > 0;
      items.push({ name: "오류 없이 끝까지 실행돼요", ok: !r.etype, msg: r.etype ? PC.errLine(r) : "" });
      items.push({ name: "무언가를 화면에 출력해요", ok: changed && !!(r.out || "").trim(), msg: "print()로 결과를 보여 주세요" });
      return { items, passed: items.every((i) => i.ok) };
    }
    for (const t of step.tests || []) {
      let src = code;
      if (t.replace) {
        if (!code.includes(t.replace[0])) { items.push({ name: t.name, ok: false, msg: `처음에 주어진 줄 '${t.replace[0].slice(0, 30)}'을(를) 지우거나 바꾸지 말아 주세요` }); continue; }
        src = code.split(t.replace[0]).join(t.replace[1]);
      }
      if (t.append) src += "\n" + t.append;
      const r = await PC.run(src, t.stdin || "");
      const j = PC.judge(t, r);
      items.push({ name: t.name, ok: j.ok, msg: j.msg });
    }
    PC.checkCode(step, code).forEach((i) => items.push(i));
    return { items, passed: items.every((i) => i.ok) };
  };

  /* ---------- 파이썬 색칠 ---------- */
  const KW = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "));
  const BI = new Set("print input int float str bool len range list dict set tuple sum min max abs round sorted enumerate zip open type isinstance map filter".split(" "));
  const TOK = /(#[^\n]*)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[fFrRbB]{0,2}"(?:\\.|[^"\\\n])*"?|[fFrRbB]{0,2}'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_가-힣][\w가-힣]*)/g;
  PC.highlight = (code) => {
    let html = "", last = 0, m, prevDef = false;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(code))) {
      html += PC.esc(code.slice(last, m.index));
      const t = m[0];
      let cls = "";
      if (m[1]) cls = "c"; else if (m[2]) cls = "s"; else if (m[3]) cls = "n";
      else if (KW.has(t)) cls = "k";
      else if (BI.has(t)) cls = "b";
      else if (prevDef || code[TOK.lastIndex] === "(") cls = "f";
      prevDef = m[4] && (t === "def" || t === "class");
      html += cls ? `<span class="t${cls}">${PC.esc(t)}</span>` : PC.esc(t);
      last = TOK.lastIndex;
    }
    return html + PC.esc(code.slice(last)) + "\n";
  };

  /* ---------- 코드 에디터 ---------- */
  PC.editor = (host, opts) => {
    opts = opts || {};
    host.classList.add("ed");
    host.innerHTML = `<div class="ed-gut" aria-hidden="true"></div><div class="ed-body"><pre class="ed-hl" aria-hidden="true"><code></code></pre><textarea class="ed-in" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="${PC.esc(opts.label || "코드 입력")}"></textarea></div>`;
    const ta = host.querySelector("textarea"), code = host.querySelector("code"), gut = host.querySelector(".ed-gut"), pre = host.querySelector("pre");
    if (opts.readOnly) ta.readOnly = true;
    let errLine = 0;
    const paint = () => {
      code.innerHTML = PC.highlight(ta.value);
      const n = ta.value.split("\n").length;
      let g = ""; for (let i = 1; i <= n; i++) g += `<span${i === errLine ? ' class="err"' : ""}>${i}</span>`;
      gut.innerHTML = g;
      ta.style.height = "auto";
      ta.style.height = Math.max(ta.scrollHeight, opts.minHeight || 260) + "px";
      pre.style.height = ta.style.height;
    };
    ta.addEventListener("input", () => { errLine = 0; paint(); opts.onChange && opts.onChange(ta.value); });
    ta.addEventListener("scroll", () => { pre.scrollLeft = ta.scrollLeft; });
    const insert = (text) => {
      if (!document.execCommand("insertText", false, text)) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
    };
    ta.addEventListener("keydown", (e) => {
      if (ta.readOnly) return;
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      if (e.key === "Tab" && !e.shiftKey && s === en) { e.preventDefault(); insert("    "); }
      else if (e.key === "Tab") {
        e.preventDefault();
        const endLine = v.indexOf("\n", en - 1 < s ? s : en - 1); const stop = endLine < 0 ? v.length : endLine;
        const block = v.slice(lineStart, stop);
        const nb = e.shiftKey ? block.replace(/^ {1,4}/gm, "") : block.replace(/^/gm, "    ");
        ta.setSelectionRange(lineStart, stop); insert(nb); ta.setSelectionRange(lineStart, lineStart + nb.length);
      } else if (e.key === "Enter" && !e.isComposing) {
        const line = v.slice(lineStart, s);
        let ind = (line.match(/^ */) || [""])[0];
        if (/:\s*(#.*)?$/.test(line)) ind += "    ";
        e.preventDefault(); insert("\n" + ind);
      } else if (e.key === "Backspace" && s === en && s > lineStart) {
        const before = v.slice(lineStart, s);
        if (/^ +$/.test(before) && before.length % 4 === 0) { e.preventDefault(); ta.setSelectionRange(s - 4, s); insert(""); }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); opts.onRun && opts.onRun(); }
    });
    paint();
    return {
      el: ta,
      get value() { return ta.value; },
      set value(v) { ta.value = v; paint(); },
      markError(line) { errLine = line || 0; paint(); },
      focus() { ta.focus(); }
    };
  };

  /* ---------- 오류 미리 검사 (실행하지 않고 흔한 실수 찾기) ---------- */
  // 문자열과 주석을 빈칸으로 가린 줄을 돌려줘요. 따옴표가 안 닫혔으면 open = true
  function mask(line) {
    let out = "", q = "", open = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === "\\") { out += "  "; i++; continue; }
        if (ch === q) { q = ""; out += ch; } else out += " ";
      } else if (ch === '"' || ch === "'") {
        if (line.substr(i, 3) === ch.repeat(3)) return { text: out, open: false, triple: true };
        q = ch; out += ch;
      } else if (ch === "#") break;
      else out += ch;
    }
    if (q) open = true;
    return { text: out, open };
  }
  PC.lint = (code) => {
    const issues = [];
    const add = (line, msg, level) => issues.push({ line, msg, level: level || "warn" });
    const lines = code.split("\n");
    let depth = 0, depthLine = 0, inTriple = false;
    let prevBlock = false, prevIndent = 0, prevLineNo = 0;
    const inputVars = new Set();
    lines.forEach((raw, idx) => {
      const n = idx + 1;
      if (inTriple) { if ((raw.match(/"""|'''/g) || []).length % 2 === 1) inTriple = false; return; }
      const m = mask(raw);
      if (m.triple) { if ((raw.match(/"""|'''/g) || []).length % 2 === 1) inTriple = true; return; }
      const t = m.text, s = t.trim();
      if (/[“”‘’]/.test(raw)) add(n, "둥근 따옴표(“ ” ‘ ’)가 있어요. 키보드의 곧은 따옴표 \" 또는 ' 로 바꿔요.", "err");
      if (/[（）：，]/.test(t)) add(n, "전각 문자(（ ） ： ，)가 있어요. 한/영 키를 눌러 영문 상태에서 ( ) : , 를 다시 입력해요.", "err");
      if (!s) return;
      if (m.open) add(n, "따옴표가 닫히지 않았어요. 여는 따옴표와 닫는 따옴표의 짝을 확인해요.", "err");
      if (/\t/.test(raw.match(/^\s*/)[0])) add(n, "들여쓰기에 Tab 문자가 섞여 있어요. 스페이스 4칸으로 맞춰요.");
      const indent = raw.match(/^ */)[0].length;
      const startDepth = depth;
      for (const ch of t) {
        if ("([{".includes(ch)) { if (!depth) depthLine = n; depth++; }
        else if (")]}".includes(ch)) { depth--; if (depth < 0) { add(n, "닫는 괄호가 여는 괄호보다 많아요.", "err"); depth = 0; } }
      }
      if (startDepth > 0) return; // 괄호 안에서 이어지는 줄
      if (indent % 4 !== 0) add(n, `들여쓰기가 ${indent}칸이에요. 4칸 단위(0, 4, 8…)로 맞추면 오류가 줄어요.`);
      if (prevBlock && indent <= prevIndent) add(n, `${prevLineNo}번째 줄이 콜론(:)으로 끝났는데 이 줄이 들여쓰기 되지 않았어요. 4칸 들여써요.`, "err");
      if (!prevBlock && prevLineNo && indent > prevIndent && depth === 0) add(n, "앞 줄이 콜론(:)으로 끝나지 않았는데 들여쓰기가 더 깊어요.", "err");
      const kw = s.match(/^(if|elif|else|for|while|def|class|try|except|finally|with)\b/);
      const endsColon = /:\s*$/.test(s);
      if (kw && depth === 0 && !endsColon && !/:\s*\S/.test(s.slice(kw[0].length))) add(n, `${kw[1]} 줄 끝에 콜론(:)이 없어요.`, "err");
      if (/^(if|elif|while)\b/.test(s) && /[^=!<>]=[^=]/.test(s.replace(/:\s*$/, "")) && !/==|!=|<=|>=/.test(s)) add(n, "조건에서 '같다'는 = 가 아니라 == 예요.", "err");
      else if (/^(if|elif|while)\b[^=]*[^=!<>]=[^=]/.test(s.replace(/[<>!=]=/g, "~~"))) add(n, "조건 안에 = 하나만 쓴 곳이 있어요. 비교는 == 로 써요.", "err");
      if (/=<|=>/.test(s)) add(n, "=< 나 => 는 없어요. <= 또는 >= 로 써요.", "err");
      if (/^else\s+if\b/.test(s) || /^elseif\b/.test(s)) add(n, "파이썬에서는 else if 대신 elif 를 써요.", "err");
      if (/^else\b\s*[^:\s]/.test(s) && !/^else\s+if/.test(s)) add(n, "else 뒤에는 조건을 쓰지 않아요. 조건이 필요하면 elif 를 써요.", "err");
      const cap = s.match(/^(Print|If|For|While|Def|Else|Elif|Input|Return)\b/);
      if (cap) add(n, `${cap[1]} 의 첫 글자를 소문자로 써요 (${cap[1].toLowerCase()}).`, "err");
      if (/\b(true|false|none)\b/.test(s)) add(n, "True, False, None 은 첫 글자가 대문자예요.");
      if (/^print\s+[^(=\s]/.test(s)) add(n, "print 뒤에 괄호가 필요해요. print(\"내용\") 처럼 써요.", "err");
      if (/^def\s+[^\s(]+\s*:/.test(s)) add(n, "함수 이름 뒤에 괄호가 필요해요. def 이름(): 처럼 써요.", "err");
      if (/^for\b/.test(s) && !/\bin\b/.test(s)) add(n, "for문에는 in 이 필요해요. for 변수 in 리스트: 처럼 써요.", "err");
      const iv = s.match(/^([A-Za-z_\uAC00-\uD7A3][\w\uAC00-\uD7A3]*)\s*=\s*input\s*\(/);
      if (iv) inputVars.add(iv[1]);
      const cv = s.match(/^([A-Za-z_\uAC00-\uD7A3][\w\uAC00-\uD7A3]*)\s*=\s*(int|float)\s*\(/);
      if (cv) inputVars.delete(cv[1]);
      inputVars.forEach((v) => {
        const e = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(^|[^\\w\\uAC00-\\uD7A3.])${e}\\s*([-*/%]|[<>]=?|\\+\\s*\\d)|\\d\\s*[-+*/%<>]=?\\s*${e}(?![\\w\\uAC00-\\uD7A3(])`).test(s) && !iv)
          add(n, `${v} 은(는) input()으로 받은 문자열이에요. 숫자로 계산하거나 비교하려면 int(${v}) 로 바꿔요.`);
      });
      prevBlock = endsColon && depth === 0; prevIndent = indent; prevLineNo = n;
    });
    if (depth > 0) add(depthLine, "여는 괄호가 닫히지 않았어요. 괄호의 짝을 세어 봐요.", "err");
    if (prevBlock) add(prevLineNo, "콜론(:)으로 끝난 줄 아래에 실행할 내용이 없어요. 들여써서 코드를 쓰거나 pass 를 넣어요.", "err");
    const seen = new Set();
    return issues.filter((i) => { const k = i.line + i.msg; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.line - b.line);
  };
})();
