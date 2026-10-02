# ==============================================================================
# 🤖 모듈 1: 머신러닝 · 선형회귀 (Colab 실습 버전)
# ------------------------------------------------------------------------------
# 📌 이 모듈에서 배우는 것 (3줄 요약)
#   1. AI가 데이터 점들을 보고 스스로 직선(y = Wx + b)을 찾아내는 원리를 배워요.
#   2. '경사하강법'으로 AI가 조금씩 정답에 가까워지는 과정을 체험해요.
#   3. 표(pandas)와 그래프(matplotlib)로 학습 과정을 눈으로 확인해요.
# 🎒 준비물: 구글 코랩(Colab) — 위에서부터 셀을 순서대로 실행하기만 하면 돼요!
# 📖 선수 지식: 일차함수 y = ax + b (중학교 수학이면 충분해요)
# 💡 용어 미리보기 (처음 보면 아래 뜻을 떠올려 보세요!)
#   - 가중치(W)란? AI가 "이 입력이 얼마나 중요할까?"라고 생각하는 정도예요. (직선의 기울기!)
#   - 편향(b)이란?   입력이 0이어도 나오는 기본값이에요. (직선의 y절편!)
#   - 손실함수(MSE)란? AI의 예측이 정답과 얼마나 다른지 재는 '틀린 정도 점수'예요.
#   - 경사하강법이란?  '틀린 정도'를 조금씩 줄여나가는 AI의 공부 방법이에요.
#                      안개 낀 산에서 가장 낮은 골짜기를 찾아 내려가는 것과 같아요!
# ==============================================================================
#한글을 그래프에 보여주는 라이브러리
!pip install koreanize_matplotlib
import koreanize_matplotlib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# ==========================================
# 1. 10개 점 데이터 준비 및 CSV 로드
#    AI에게 보여줄 '문제집'이에요 (x: 공부 시간, y: 시험 점수)
# ==========================================
csv_data = """x,y
1,2.1
2,3.8
3,6.2
4,7.9
5,10.2
6,12.1
7,13.9
8,16.2
9,18.0
10,20.3
"""
# 위 문자열을 data.csv 파일로 저장해요 (표 형태로 저장하는 것!)
with open('data.csv', 'w') as f:
    f.write(csv_data)

# 저장한 표를 다시 읽어와요
df = pd.read_csv('data.csv')
x = df['x'].values   # 입력: 공부 시간들
y = df['y'].values   # 정답: 시험 점수들
N = len(x)           # 데이터 개수 (10개)

print("--- [AI 에듀 실습: 10개 점 데이터셋] ---")
print(df)
# ✅ 체크포인트: 위에 x=1~10, y 점수 10개가 보이면 성공!

# ==========================================
# 2. 하이퍼파라미터 및 학생 테스트 입력값
#    하이퍼파라미터란? AI가 공부하기 전에 사람이 정해주는 '공부 규칙'이에요
# ==========================================
learning_rate = 0.01  # 학습률 (alpha): 한 번에 얼마나 크게 고칠지 (너무 크면 산에서 미끄러져요!)
epochs = 100          # 반복 횟수: 문제집 전체를 몇 번 반복해서 풀지
W = 0.0               # 초기 가중치: 0에서 시작해요
b = 0.0               # 초기 편향: 0에서 시작해요
student_x = 5.5       # [학생 실습] 테스트 입력값! "5.5시간 공부하면 몇 점일까?"를 맞혀봐요

history = []
trajectory = []       # 2차 곡선 궤적 저장 [(W, loss)]

# ==========================================
# 3. 경사하강법(Gradient Descent) 반복: AI의 공부 시간! 🏔️
#    매 에포크마다 "틀린 정도(손실)"를 재고 W, b를 조금씩 고쳐나가요
# ==========================================
for epoch in range(1, epochs + 1):
    y_pred = W * x + b          # ① 예측: 지금 실력(W, b)으로 점수 맞혀보기
    error = y_pred - y          # ② 오차: 예측 - 정답 (얼마나 틀렸나?)
    loss = np.mean(error ** 2)  # ③ 손실(MSE): '틀린 정도 점수' (제곱해서 평균내요)

    trajectory.append((W, loss))  # 공이 굴러가는 흔적을 기록해요 (나중에 그래프로!)

    dW = (2 / N) * np.sum(error * x)  # 기울기: W를 어느 방향으로 얼마나 고칠지
    db = (2 / N) * np.sum(error)      # 기울기: b를 어느 방향으로 얼마나 고칠지

    W -= learning_rate * dW  # ④ 공부: 기울기의 반대 방향으로 조금씩 이동 (산 내려가기!)
    b -= learning_rate * db  # ④ 공부: b도 함께 조금씩 이동

    mult_val = student_x * W       # 학습된 W로 5.5시간 공부한 경우를 계산해 봐요
    student_pred_y = mult_val + b

    if epoch == 1 or epoch % 10 == 0 or epoch == epochs:
        history.append({
            'Epoch': epoch,
            '가중치(W)': round(W, 4),
            '편향(b)': round(b, 4),
            '손실(MSE)': round(loss, 4),
            '가중치곱(x*W)': round(mult_val, 4),
            '출력 Ŷ': round(student_pred_y, 4)
        })
# ✅ 체크포인트: 아래 표에서 손실(MSE)이 점점 줄어들면 AI가 공부하고 있는 거예요!

# ==========================================
# 4. 에포크별 수렴 과정 표 출력
# ==========================================
result_df = pd.DataFrame(history)
print("\n--- [에포크별 수렴 기록 표] ---")
print(result_df.to_string(index=False))

mult_result = student_x * W
final_y = mult_result + b

# ==========================================
# 5. 콘솔 4단계 노드 순전파 브리핑: 학습이 끝난 AI에게 질문하기
#    입력(x) → 가중치 곱(x*W) → 편향 더하기(+b) → 출력(Ŷ) 순서로 흘러가요
# ==========================================
print("\n" + "="*65)
print("🧠 [AI 에듀 | 동그란 노드를 통한 4단계 가중치 곱 전파]")
print("="*65)
print(f"""
  [1단계] 입력 노드 (X)     : x = {student_x:.4f}
               │
               │  ✖ 가중치 곱 (× W: {W:.4f})
               ▼
  [2단계] 가중치 곱 (x × W) : {student_x:.2f} × {W:.4f} = {mult_result:.4f}
               │
               ▼
  [3단계] 편향 더하기 (+ b) : + {b:.4f}
               │
               │  (합산 연산 Σ: {mult_result:.4f} + {b:.4f})
               ▼
  [4단계] 출력 노드 (Ŷ)     : Ŷ = {final_y:.4f} (최종 예측값)
""")
print("="*65)

# ==========================================
# 6. 프리미엄 포털 테마 3단 시각화:
#    (1) 2D 평면좌표 & 회귀선 — AI가 찾아낸 직선이 점들 사이에 잘 그어졌나요?
#    (2) 2차 함수 손실 곡선 & 경사하강법 공 굴리기 — 공이 골짜기로 데굴데굴!
#    (3) 동그란 노드 순전파 다이어그램 — 신호가 노드를 타고 흐르는 모습
# ==========================================
_BLUE = '#1f4ef5'
_GREEN = '#03c75a'
_PINK = '#ec4899'
_INDIGO = '#4f46e5'
_BORDER = '#e5e8eb'

fig, axes = plt.subplots(1, 3, figsize=(18, 5), facecolor='#f4f6f8')

# (1) 좌측: 2D 평면좌표 & 회귀직선
ax1 = axes[0]
ax1.set_facecolor('#ffffff')
ax1.scatter(x, y, color=_GREEN, s=70, edgecolors='#ffffff', linewidth=1.5, zorder=4, label='Data Points (10개 점)')
ax1.plot(x, W * x + b, color=_BLUE, linewidth=2.5, zorder=3, label=f'Line: y={W:.2f}x+{b:.2f}')
ax1.scatter([student_x], [final_y], color='#ff4d4f', s=120, edgecolors='#ffffff', linewidth=2, zorder=5, label=f'Test (x={student_x}, ŷ={final_y:.2f})')
ax1.set_title('1. 2D Coordinate & Regression Line', fontsize=12, fontweight='bold', color='#111111')
ax1.set_xlabel('X (Input)', color='#444444')
ax1.set_ylabel('Y (Output)', color='#444444')
ax1.legend(frameon=True, facecolor='#ffffff', edgecolor=_BORDER)
ax1.grid(True, linestyle='--', color='#f0f2f5')
for spine in ax1.spines.values():
    spine.set_color(_BORDER)

# (2) 중앙: 2차 함수 형태의 손실 곡선 (Loss Curve) & 경사하강법 궤적
ax2 = axes[1]
ax2.set_facecolor('#ffffff')
w_range = np.linspace(-0.5, 4.0, 150)
loss_curve = [np.mean((tw * x + b - y) ** 2) for tw in w_range]
ax2.plot(w_range, loss_curve, color=_BLUE, linewidth=2.5, label='Loss(W) = 2차 포물선')

# 궤적 (에포크별 공 굴리기 이동 흔적)
traj_w = [t[0] for t in trajectory]
traj_loss = [t[1] for t in trajectory]
ax2.plot(traj_w, traj_loss, color='#ff8787', linestyle='--', linewidth=1.5, alpha=0.7, label='Gradient Descent Path')
ax2.scatter(traj_w[::10], traj_loss[::10], color='#ff6b6b', s=30, zorder=4)

# 최종 위치 공 (빨간색 공)
ax2.scatter([W], [np.mean((W * x + b - y) ** 2)], color='#ff4d4f', s=120, edgecolors='#ffffff', linewidth=2, zorder=5, label=f'Final W={W:.2f}')
# 최저점 (기울기=0)
opt_w = np.sum(x * (y - b)) / np.sum(x ** 2)
ax2.scatter([opt_w], [np.mean((opt_w * x + b - y) ** 2)], color=_GREEN, s=90, marker='*', zorder=5, label=f'Minimum (W*={opt_w:.2f})')

ax2.set_title('2. Loss Function (2차 함수 경사하강법)', fontsize=12, fontweight='bold', color='#111111')
ax2.set_xlabel('Weight (W)', color='#444444')
ax2.set_ylabel('Loss (MSE)', color='#444444')
ax2.set_ylim(0, max(loss_curve) * 0.9)
ax2.legend(frameon=True, facecolor='#ffffff', edgecolor=_BORDER, fontsize=9)
ax2.grid(True, linestyle='--', color='#f0f2f5')
for spine in ax2.spines.values():
    spine.set_color(_BORDER)

# (3) 우측: 동그란 노드를 통한 순전파 다이어그램
ax3 = axes[2]
ax3.set_facecolor('#ffffff')
ax3.set_xlim(-0.2, 3.2)
ax3.set_ylim(-0.2, 2.2)
ax3.axis('off')
ax3.set_title('3. Single Neuron Forward Flow', fontsize=12, fontweight='bold', color='#111111')

node_x = (0.2, 1.5)
node_b = (0.2, 0.5)
node_sum = (1.5, 1.0)
node_out = (2.8, 1.0)

ax3.annotate('', xy=node_sum, xytext=node_x, arrowprops=dict(arrowstyle="->", color="#cce0ff", lw=3.5))
ax3.annotate('', xy=node_sum, xytext=node_b, arrowprops=dict(arrowstyle="->", color="#fce7f3", lw=2.5))
ax3.annotate('', xy=node_out, xytext=node_sum, arrowprops=dict(arrowstyle="->", color="#d1fae5", lw=3.5))

ax3.text(0.85, 1.45, f"✖ Weight (× W = {W:.2f})\n[ 곱: {student_x:.2f} × {W:.2f} = {mult_result:.2f} ]",
         ha='center', va='center', fontsize=9, fontweight='bold', color=_BLUE,
         bbox=dict(boxstyle="round,pad=0.3", fc="#ffffff", ec=_BLUE, lw=1.2))

ax3.text(0.85, 0.55, f"➕ Bias (+ b = {b:.2f})",
         ha='center', va='center', fontsize=9, fontweight='bold', color='#be185d',
         bbox=dict(boxstyle="round,pad=0.3", fc="#ffffff", ec=_PINK, lw=1.2))

def draw_circle(ax, pos, r, color, title, val):
    circle = plt.Circle(pos, r, color=color, ec='#ffffff', lw=2.5, zorder=4)
    ax.add_patch(circle)
    ax.text(pos[0], pos[1] + 0.05, title, ha='center', va='center', fontsize=10, fontweight='bold', color='#ffffff', zorder=5)
    ax.text(pos[0], pos[1] - 0.08, val, ha='center', va='center', fontsize=9, color='#ffffff', zorder=5)

draw_circle(ax3, node_x, 0.22, _BLUE, 'Input (x)', f'{student_x:.2f}')
draw_circle(ax3, node_b, 0.18, _PINK, 'Bias (b)', f'{b:.2f}')
draw_circle(ax3, node_sum, 0.24, _INDIGO, 'Sum (Σ)', f'{mult_result:.1f}+{b:.1f}')
draw_circle(ax3, node_out, 0.24, _GREEN, 'Output (Ŷ)', f'{final_y:.2f}')

plt.tight_layout()
plt.savefig('result_plot.png', dpi=150)
print("\n모던 포털 스타일 3단 종합 그래프가 'result_plot.png'로 저장되었습니다.")
# 🎉 수고했어요! 모듈 1 완성! 이제 시뮬레이터에서 슬라이더를 직접 움직여보세요.
