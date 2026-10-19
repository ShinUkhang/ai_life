/* AI Life 탐구 수업 공용 스크립트
 *  - [data-save="키"] 입력칸 자동 저장 (이 브라우저에만 저장, 새로고침해도 유지)
 *  - [data-download-sheet] 버튼: 활동지(예측·결과·설명 + 변수 실험 기록)를 .txt로 내려받기
 *  - LiveCode: 슬라이더 값 = 코드 속 변수 값 을 나란히 보여 주는 작은 코드 패널
 */
(function () {
  const PAGE = document.body.dataset.lesson || location.pathname;
  const key = (k) => "ailife:" + PAGE + ":" + k;
  const store = {
    get(k) { try { return localStorage.getItem(key(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(key(k), v); } catch (e) {} },
  };

  function bindSaves() {
    document.querySelectorAll("[data-save]").forEach((el) => {
      const k = el.dataset.save;
      const v = store.get(k);
      if (v !== null && v !== "") el.value = v;
      el.addEventListener("input", () => store.set(k, el.value));
    });
  }

  function sheetText() {
    const title = document.body.dataset.title || document.title;
    const id = (document.getElementById("stuId") || {}).value || "";
    const name = (document.getElementById("stuName") || {}).value || "";
    const now = new Date();
    let t = `[AI Life 활동지] ${title}\n학번: ${id}   이름: ${name}   날짜: ${now.toLocaleDateString("ko-KR")}\n`;
    t += "=".repeat(48) + "\n";
    let lastGroup = "";
    document.querySelectorAll("[data-save][data-label]").forEach((el) => {
      const g = el.dataset.group || "";
      if (g && g !== lastGroup) { t += `\n■ ${g}\n`; lastGroup = g; }
      t += `- ${el.dataset.label}: ${(el.value || "(비어 있음)").trim()}\n`;
    });
    const hist = window._runHistory ? Object.values(window._runHistory).flat() : [];
    if (hist.length) {
      t += "\n■ 변수 실험 기록 (코드 실험실)\n";
      hist.forEach((h, i) => {
        t += `${i + 1}. ${h.vars.map(([k, v]) => k + "=" + v).join(", ")}  →  ${h.result}\n`;
      });
    }
    return { t, id, name };
  }

  function download() {
    const { t, id, name } = sheetText();
    if (!id || !name) {
      alert("학번과 이름을 먼저 적어 주세요!");
      (document.getElementById(id ? "stuName" : "stuId") || {}).focus?.();
      return;
    }
    const no = document.body.dataset.no || "";
    const blob = new Blob(["﻿" + t], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${id}_${name}_${no}차시_활동지.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  window.AILesson = { sheetText, download };

  document.addEventListener("DOMContentLoaded", () => {
    bindSaves();
    document.querySelectorAll("[data-download-sheet]").forEach((b) => b.addEventListener("click", download));
    document.querySelectorAll("[data-copy-target]").forEach((b) => b.addEventListener("click", () => {
      const src = document.getElementById(b.dataset.copyTarget);
      if (src && typeof copyRunnerCode === "function") copyRunnerCode(src.id);
    }));
  });
})();

/* 슬라이더 값을 코드 줄로 보여 주는 패널
 * new LiveCode(el, [["TEMPERATURE", "1.0", "온도: 클수록 엉뚱한 단어도 고름"], ...])
 * .set("TEMPERATURE", "0.5") → 해당 줄이 노랗게 깜빡임 */
class LiveCode {
  constructor(el, rows) {
    this.el = el; this.rows = rows; this.last = {};
    this.render(null);
  }
  set(name, value) {
    const r = this.rows.find((x) => x[0] === name);
    if (!r || r[1] === String(value)) return;
    r[1] = String(value);
    this.render(name);
  }
  render(changed) {
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    this.el.innerHTML = this.rows.map(([k, v, c]) =>
      `<div${k === changed ? ' class="flash"' : ""}><span class="k">${esc(k)}</span> = <span class="n">${esc(v)}</span>${c ? `   <span class="c"># ${esc(c)}</span>` : ""}</div>`
    ).join("");
  }
}
