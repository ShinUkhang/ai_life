"""
[실습 1-4B] Gradio 웹캠 버전
구글 코랩의 eval_js 대신 Gradio로 웹캠 사진을 찍고 테두리를 확인합니다.

실행: python webcam_gradio.py
"""

import gradio as gr
import numpy as np

def take_and_annotate(img):
    """웹캠 이미지를 받아 테두리(안내선)를 그려 반환"""
    if img is None:
        return None
    h, w = img.shape[:2]
    out = img.copy()
    # 얼굴/손 위치 안내용 테두리 (중앙 사각형)
    x1, y1 = int(w * 0.3), int(h * 0.2)
    x2, y2 = int(w * 0.7), int(h * 0.8)
    # 초록색 테두리 그리기 (numpy 슬라이싱)
    t = 4
    out[y1:y1+t, x1:x2] = [3, 199, 90]      # 위
    out[y2-t:y2, x1:x2] = [3, 199, 90]      # 아래
    out[y1:y2, x1:x1+t] = [3, 199, 90]      # 왼쪽
    out[y1:y2, x2-t:x2] = [3, 199, 90]      # 오른쪽
    return out

with gr.Blocks(title="실습 1-4B 웹캠 찰칵") as demo:
    gr.Markdown("## 📸 [실습 1-4B] 웹캠으로 내 손/얼굴 찰칵 찍어서 테두리 확인하기")
    gr.Markdown("웹캠 버튼을 눌러 사진을 찍으면 초록색 테두리가 표시됩니다.")
    with gr.Row():
        inp = gr.Image(sources=["webcam"], type="numpy", label="웹캠 촬영")
        out = gr.Image(type="numpy", label="테두리 확인")
    btn = gr.Button("📸 찰칵! 테두리 확인", variant="primary")
    btn.click(fn=take_and_annotate, inputs=inp, outputs=out)
    # 실시간 모드도 지원
    gr.Markdown("💡 실시간으로 보려면 아래를 켜세요.")
    live = gr.Image(sources=["webcam"], type="numpy", label="실시간", streaming=True)
    live_out = gr.Image(type="numpy", label="실시간 테두리")
    live.stream(fn=take_and_annotate, inputs=live, outputs=live_out)

if __name__ == "__main__":
    demo.launch(share=False)
