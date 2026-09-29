import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# ==========================================
# 1. 10개 점 데이터 준비 및 CSV 로드
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
with open('data.csv', 'w') as f:
    f.write(csv_data)

df = pd.read_csv('data.csv')
x = df['x'].values
y = df['y'].values
N = len(x)

print("--- [AI 에듀 실습: 10개 점 데이터셋] ---")
print(df)

# ==========================================
# 2. 하이퍼파라미터 및 학생 테스트 입력값
# ==========================================
learning_rate = 0.01  # 학습률 (alpha)
epochs = 100          # 반복 횟수
W = 0.0               # 초기 가중치
b = 0.0               # 초기 편향
student_x = 5.5       # [학생 실습] 임의의 테스트 입력값

history = []
trajectory = []       # 2차 곡선 궤적 저장 [(W, loss)]

# ==========================================
# 3. 경사하강법(Gradient Descent) 반복
# ==========================================
for epoch in range(1, epochs + 1):
    y_pred = W * x + b
    error = y_pred - y
    loss = np.mean(error ** 2)
    
    trajectory.append((W, loss))
    
    dW = (2 / N) * np.sum(error * x)
    db = (2 / N) * np.sum(error)
    
    W -= learning_rate * dW
    b -= learning_rate * db
    
    mult_val = student_x * W
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

# ==========================================
# 4. 에포크별 수렴 과정 표 출력
# ==========================================
result_df = pd.DataFrame(history)
print("\n--- [에포크별 수렴 랭킹 표] ---")
print(result_df.to_string(index=False))

mult_result = student_x * W
final_y = mult_result + b

# ==========================================
# 5. 콘솔 4단계 노드 순전파 브리핑
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
#    (1) 2D 평면좌표 & 회귀선
#    (2) 2차 함수 손실 곡선 & 경사하강법 공 굴리기
#    (3) 동그란 노드 순전파 다이어그램
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
