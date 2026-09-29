import csv

# 1. CSV 데이터 읽기
x_data = []
y_data = []

with open('data.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    for row in reader:
        if row:
            x_data.append(float(row[0]))
            y_data.append(float(row[1]))

N = len(x_data)
print(f"데이터 {N}개 로드 완료: {list(zip(x_data, y_data))}\n")

# 2. 하이퍼파라미터
learning_rate = 0.01
epochs = 100
W = 0.0
b = 0.0
student_x = 5.5000

print(f"{'Epoch':^6} | {'가중치(W)':^10} | {'편향(b)':^10} | {'손실(MSE)':^11} | {'가중치 곱(x*W)':^14} | {f'출력 Ŷ':^12}")
print("-" * 75)

# 3. 경사하강법
for epoch in range(1, epochs + 1):
    dW = 0.0
    db = 0.0
    total_loss = 0.0
    
    for x, y in zip(x_data, y_data):
        y_pred = W * x + b
        diff = y_pred - y
        dW += (2.0 / N) * diff * x
        db += (2.0 / N) * diff
        total_loss += (diff ** 2) / N
        
    W = W - learning_rate * dW
    b = b - learning_rate * db
    
    mult_val = student_x * W
    student_pred = mult_val + b
    
    if epoch == 1 or epoch % 10 == 0 or epoch == epochs:
        print(f"{epoch:6d} | {W:10.4f} | {b:10.4f} | {total_loss:11.4f} | {mult_val:14.4f} | {student_pred:12.4f}")

print("-" * 75)

mult_result = student_x * W
final_y = mult_result + b

# 4. 동그란 노드를 통한 4단계 순전파 브리핑
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
print(f"최종 선형회귀 수식: y = {W:.4f} * x + {b:.4f}")
