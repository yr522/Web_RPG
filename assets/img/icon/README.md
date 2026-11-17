# 아이콘 폴더

그림은 **32 × 32** PNG(투명 바탕). 폴더 안 어디에 두든 게임이 자동으로 읽는다.
파일 이름은 영문 소문자·숫자·밑줄(`_`)만. 예: `sword_001_wooden.png`

| 폴더 | 넣는 것 |
|---|---|
| `equipment/weapon/sword` | 검사 무기 (검) |
| `equipment/weapon/staff` | 마법사 무기 (지팡이) |
| `equipment/weapon/bow` | 궁수 무기 (활) |
| `equipment/hat` | 모자 |
| `equipment/top` | 상의 |
| `equipment/bottom` | 하의 |
| `equipment/gloves` | 장갑 |
| `equipment/shoes` | 신발 |
| `equipment/necklace` | 목걸이 |
| `equipment/ring` | 반지 |
| `equipment/armor` | 예전 테스트 장비 그림 (그대로 둠) |
| `item/material` | 몬스터 재료 (슬라임 점액 같은 것) |
| `item/potion` | 포션 |
| `item/scroll` | 주문서 |
| `item/quest` | 퀘스트 아이템 |
| `coin` | 동전 |

- 이름 규칙: `부위_번호_이름` (예: `hat_001_cap`, `ring_002_ruby`). 번호는 부위마다 001부터
- 등급만 다른 같은 장비는 그림 하나를 같이 쓴다. 등급 색은 게임이 칸 테두리로 보여 줌
- `.gitkeep` 은 빈 폴더를 저장소에 남기려는 빈 파일. 그림을 넣은 뒤 지워도 되고 둬도 됨
- 그림을 다 넣으면 어떤 아이템에 어떤 파일을 쓸지만 알려 주면 연결함
