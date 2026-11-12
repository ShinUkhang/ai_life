"""
[실습 1-4B] Gradio 웹캠 버전
구글 코랩의 eval_js 대신 Gradio로 웹캠 사진을 찍고 Canny 테두리를 확인합니다.

준비: pip install gradio opencv-python numpy
실행: python webcam_gradio.py
"""

import gradio as gr
import numpy as np
import cv2

def detect_edges(img, low=50, high=150):
    """웹캠 이미지에 Canny 테두리 검출 적용"""
    if img is None:
        return None, None
    # 그레이스케일 변환
    img = np.asarray(img)
    if img.ndim == 3 and img.shape[2] == 4:   # 투명도(알파)가 붙은 사진이면 RGB로
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
    if img.ndim == 2:                         # 흑백 사진이면 색 채널을 만들어 줘요
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    # Canny 테두리 검출 (하한이 상한보다 크면 서로 바꿔요)
    low, high = sorted((int(low), int(high)))
    edges = cv2.Canny(gray, low, high)
    # 원본에 테두리 오버레이 (빨간색)
    overlay = img.copy()
    overlay[edges > 0] = [255, 0, 0]
    return overlay, edges

with gr.Blocks(title="실습 1-4B 웹캠 테두리 검출") as demo:
    gr.Markdown("## 📸 [실습 1-4B] 웹캠으로 내 손/얼굴 찰칵 찍어서 테두리 확인하기")
    gr.Markdown("웹캠 버튼을 눌러 사진을 찍으면 Canny 테두리가 표시됩니다. 슬라이더로 임계값을 조절해보세요!")
    with gr.Row():
        low = gr.Slider(0, 200, value=50, label="하한 임계값")
        high = gr.Slider(0, 300, value=150, label="상한 임계값")
    with gr.Row():
        inp = gr.Image(sources=["webcam", "upload"], type="numpy", label="웹캠 촬영 (안 되면 사진 올리기)")
    with gr.Row():
        out_overlay = gr.Image(type="numpy", label="테두리 오버레이 (빨간선)")
        out_edges = gr.Image(type="numpy", label="테두리만 (흑백)")
    btn = gr.Button("📸 찰칵! 테두리 검출", variant="primary")
    btn.click(fn=detect_edges, inputs=[inp, low, high], outputs=[out_overlay, out_edges])

if __name__ == "__main__":
    # 내 컴퓨터(localhost)에서 열리므로 웹캠 권한이 바로 동작해요. 브라우저가 물으면 '허용'을 눌러요.
    demo.launch(share=False, inbrowser=True)
