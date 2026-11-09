# Web_RPG
웹게임 마법학교 RPG 게임입니다.

## 바로 플레이
**https://yr522.github.io/Web_RPG/** — `main` 에 머지되면 1~2분 뒤 자동으로 업데이트돼요.

## 실행 방법
[Node.js](https://nodejs.org/) 20 이상이 필요해요.

```bash
npm install     # 처음 한 번
npm run dev     # 개발 서버 → 브라우저에서 http://localhost:5173
npm run build   # 배포용 빌드 → dist/
```

- `?ui=mobile` / `?ui=pc` : PC에서 모바일 UI를 미리 보거나 반대로 강제
- `?reset=1` : 저장 데이터 지우고 새로 시작

## 폴더 구조
| 폴더 | 내용 |
|---|---|
| `shared/` | 게임 로직·데이터 (Phaser·화면을 모름 → 나중에 서버에서도 그대로 사용) |
| `client/` | Phaser 화면, HUD(UI), 입력 |
| `document/` | 기획서, 세계관 |
| `prototype/` | 이전 단일 HTML 프로토타입 (v0.4.7, 참고용) |
| `assets/`, `fonts/` | 그림, 폰트 |

기술: Phaser 3 + TypeScript + Vite (기획서 12장)
