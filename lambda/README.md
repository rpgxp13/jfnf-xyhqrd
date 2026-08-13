# Fortune LLM 프록시 — AWS Lambda 배포 가이드

사주/타로 상세 풀이를 Claude API로 생성해주는 프록시입니다.
API 키는 Lambda 환경변수에만 저장되고 브라우저에 노출되지 않습니다.

## 1. 배포 패키지 만들기 (로컬 PC)

```bash
cd lambda
npm install
```

`lambda` 폴더 전체(index.mjs + package.json + node_modules)를 zip으로 압축합니다.
PowerShell 기준:

```powershell
Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force
```

## 2. Lambda 함수 생성 (AWS 콘솔)

1. AWS 콘솔 → Lambda → **함수 생성**
   - 이름: `fortune-llm-proxy`
   - 런타임: **Node.js 22.x** (또는 20.x)
   - 아키텍처: arm64 (저렴) 또는 x86_64
2. 생성 후 **코드 → 업로드 → .zip 파일**로 `function.zip` 업로드
3. **구성 → 일반 구성**: 제한 시간을 **1분**으로 변경 (기본 3초는 부족)
4. **구성 → 환경 변수**에 추가:

   | 키 | 값 |
   |---|---|
   | `ANTHROPIC_API_KEY` | Anthropic 콘솔(platform.claude.com)에서 발급한 API 키 |
   | `MODEL` | (선택) 기본 `claude-opus-5`. 비용을 줄이려면 `claude-haiku-4-5` |
   | `EFFORT` | (선택) 기본 `low`. 더 깊은 풀이를 원하면 `medium`/`high` |
   | `ALLOWED_ORIGINS` | (선택) 기본값에 GitHub Pages 주소가 이미 포함됨 |

## 3. Function URL 만들기

1. **구성 → 함수 URL → 함수 URL 생성**
2. 인증 유형: **NONE**
3. CORS 설정은 **비워두기** (코드에서 직접 처리하므로 중복 설정 금지)
4. 생성된 URL 복사 (예: `https://xxxx.lambda-url.ap-northeast-2.on.aws/`)

## 4. 웹페이지에 연결

`a8f3kx92/fortune.js` 상단의 상수에 URL을 붙여넣고 push:

```js
const LLM_ENDPOINT = 'https://xxxx.lambda-url.ap-northeast-2.on.aws/';
```

이후 사주/타로 결과 화면에 보라색 배경의 "상세 풀이" 카드가 추가로 표시됩니다.
Lambda가 실패하거나 URL이 없으면 기존 정적 풀이만 표시됩니다 (페이지는 항상 동작).

## 5. 테스트

```bash
curl -X POST "https://xxxx.lambda-url.....on.aws/" \
  -H "Content-Type: application/json" \
  -d '{"kind":"tarot","lang":"ko","payload":{"card":{"en":"The Sun","ko":"태양","arcana":"major","label":"XIX"},"reversed":false,"spread":"one","topic":"love","position":"pos.msg"}}'
```

`{"text":"..."}` 형태의 응답이 오면 성공입니다.

## 비용·보안 참고

- 요청당 대략 입력 ~500 토큰 + 출력 ~500 토큰. `claude-opus-5` 기준 요청당 약 $0.015,
  `claude-haiku-4-5`로 바꾸면 약 $0.003 수준입니다.
- Function URL은 공개 URL이므로 URL을 아는 사람은 누구나 호출할 수 있습니다.
  개인용 서비스이니 다음 안전장치를 권장합니다:
  - Lambda **구성 → 동시성**에서 예약된 동시성을 1~2로 제한 (폭주 방지)
  - Anthropic 콘솔에서 API 키에 **월 사용 한도(spend limit)** 설정
  - 코드의 `ALLOWED_ORIGINS`가 브라우저 호출을 GitHub Pages 출처로 제한함
    (curl 직접 호출까지 막지는 못함 — 위 두 장치가 실질적 방어선)
