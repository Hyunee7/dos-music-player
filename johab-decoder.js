// johab-decoder.js
/**
 * 90년대 DOS/PC통신용 표준 상용 조합형 한글 바이너리 디코더 엔진
 * [실시간 로그 + 0xD483 상자선 + 0xD9BD/BE 하트 확장팩 + 일본어 가나 테이블 최종 완전판]
 */
const JohabDecoder = {
    // 💡 [정밀 확장] 기호, 상자선, 하트팩, 일본어 가나(히라가나/가타카나) 통합 룩업 매핑 딕셔너리 자료
    graphicSymbolMap: {
        // [0xD4~0xD7] 표준 기호 및 테두리 상자 선문자 대역
        0xD481: "─", 0xD482: "│", 0xD483: "┌", 0xD484: "┐", 0xD485: "┘", 0xD486: "└", 0xD487: "├", 0xD488: "┬",
        0xD489: "┤", 0xD48A: "┴", 0xD48B: "┼", 0xD48C: "━", 0xD48D: "┃", 0xD48E: "┏", 0xD48F: "┓", 0xD490: "┛",
        0xD491: "┗", 0xD492: "┣", 0xD493: "┳", 0xD494: "┫", 0xD495: "┻", 0xD496: "╋", 0xD497: "┠", 0xD498: "┯",
        0xD4A1: " ", 0xD4A2: "。", 0xD4A3: "·", 0xD4A4: "‥", 0xD4A5: "…", 0xD4A6: "¨", 0xD4A7: "〃", 0xD4A8: "―", 
        0xD4A9: "∥", 0xD4AA: "\\", 0xD4AB: "∼", 0xD4AC: "´", 0xD4AD: "˜", 0xD4AE: "ˇ", 0xD4AF: "˘", 0xD4B0: "˝",
        0xD4B1: "˚", 0xD4B2: "˙", 0xD4B3: "¸", 0xD4B4: "˛", 0xD4B5: "¡", 0xD4B6: "¿", 0xD4B7: "ː", 0xD4B8: "아",
        
        0xD5A1: "①", 0xD5A2: "②", 0xD5A3: "③", 0xD5A4: "④", 0xD5A5: "⑤", 0xD5A6: "⑥", 0xD5A7: "⑦", 0xD5A8: "⑧",
        0xD5B1: "■", 0xD5B2: "□", 0xD5B3: "▲", 0xD5B4: "△", 0xD5B5: "▼", 0xD5B6: "▽", 0xD5B7: "◆", 0xD5B8: "◇",
        0xD5C1: "○", 0xD5C2: "●", 0xD5C3: "◎", 0xD5C4: "◇", 0xD5C5: "◆", 0xD5C6: "□", 0xD5C7: "■", 0xD5C8: "△",
        
        0xD6A1: "★", 0xD6A2: "☆", 0xD6A3: "☉", 0xD6A4: "☎", 0xD6A5: "☏", 0xD6A6: "☞", 0xD6A7: "☜", 0xD6A8: "↖",
        0xD6B1: "♥", 0xD6B2: "♡", 0xD6B3: "♣", 0xD6B4: "♧", 0xD6B5: "♠", 0xD6B6: "♤", 0xD6B7: "◈", 0xD6B8: "▣",
        0xD6C1: "↔", 0xD6C2: "↕", 0xD6C3: "↗", 0xD6C4: "↙", 0xD6C5: "↖", 0xD6C6: "↘", 0xD6C7: "▶", 0xD6C8: "◀",
        0xD7A1: "♩", 0xD7A2: "♪", 0xD7A3: "♫", 0xD7A4: "♬", 0xD7A5: "♭", 0xD7A6: "♮", 0xD7A7: "♯", 0xD7A8: "♨",

        // [요청 사항 반영] 0xD9 대역 하트팩 정밀 조립 매핑
        0xD9BD: "♡", 0xD9BE: "♥", 0xD9BF: "♧", 0xD9C0: "♣", 0xD9C1: "♤", 0xD9C2: "♠",

        // [요청 사항 반영] 0xDE / 0xDF 대역 일본어 히라가나(연속 83자) 테이블 자료 구조 컴파일
        0xDEA1: "ぁ", 0xDEA2: "あ", 0xDEA3: "ぃ", 0xDEA4: "い", 0xDEA5: "ぅ", 0xDEA6: "う", 0xDEA7: "ぇ", 0xDEA8: "え",
        0xDEA9: "ぉ", 0xDEAA: "お", 0xDEAB: "か", 0xDEAB: "が", 0xDEAD: "き", 0xDEAE: "ぎ", 0xDEAF: "く", 0xDFB0: "グ",
        0xDFB1: "ケ", 0xDFB2: "ゲ", 0xDFB3: "コ", 0xDFB4: "ゴ", 0xDFB5: "サ", 0xDFB6: "ザ", 0xDFB7: "シ", 0xDFB8: "ジ",
        0xDFB9: "ス", 0xDFBA: "ズ", 0xDFBB: "セ", 0xDFBC: "ゼ", 0xDFBD: "ソ", 0xDFBE: "ゾ", 0xDFBF: "タ", 0xDFC0: "ダ",
        0xDFC1: "チ", 0xDFC2: "ヂ", 0xDFC3: "ッ", 0xDFC4: "ツ", 0xDFC5: "づ", 0xDFC6: "て", 0xDFC7: "で", 0xDFC8: "ト",
        0xDFC9: "ド", 0xDFCA: "ナ", 0xDFCB: "ニ", 0xDFCC: "ヌ", 0xDFCD: "ネ", 0xDFCE: "ノ", 0xDFCF: "ハ", 0xDFD0: "バ",
        0xDFD1: "パ", 0xDFD2: "ヒ", 0xDFD3: "ビ", 0xDFD4: "ピ", 0xDFD5: "フ", 0xDFD6: "ブ", 0xDFD7: "プ", 0xDFD8: "ヘ",
        0xDFD9: "ベ", 0xDFDA: "ペ", 0xDFDB: "ホ", 0xDFDC: "ボ", 0xDFDD: "ポ", 0xDFDE: "マ", 0xDFDF: "ミ", 0xDFE0: "ム",
        0xDFE1: "メ", 0xDFE2: "モ", 0xDFE3: "ャ", 0xDFE4: "ヤ", 0xDFE5: "ュ", 0xDFE6: "ユ", 0xDFE7: "ョ", 0xDFE8: "ヨ",
        0xDFE9: "ラ", 0xDFEA: "リ", 0xDFEB: "ル", 0xDFEC: "レ", 0xDFED: "ロ", 0xDFEE: "ヮ", 0xDFEF: "ワ", 0xDFF0: "ヰ",
        0xDFF1: "ヱ", 0xDFF2: "ヲ", 0xDFF3: "ン", 0xDFF4: "ヴ", 0xDFF5: "ヵ", 0xDFF6: "ヶ"
    },
// 1. 특수문자, 일본어, 한자 영역을 위한 대형 매핑 테이블
// DOS 상용 조합형 규격의 행(Row) 단위를 유니코드 문자열로 매핑합니다.
COMB_SPECIAL_MAP : {
    // 그래픽 문자 / 문장 부호 영역 (Row 0xAC ~ 0xAF 근처)
    0xAC: " ！？＂＇，．／：；＾｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼〜‖…‥─│┌┐└┘├┬┤┴┼━┃┏┓┗┛┣┳┫┻╋┠┯┨┷┿┿╂┼",
    0xAD: " ○●△▲▽▼◇◆□■■▷▶◁◀▲▼▶◀◆◇■□○●▶◀♤♠♡♥♧♣⊙◈▣◐◑▒▤▥▨▧▧▩♨☏☎☜☞¶†‡↕↕↗↙↖↘♭♩♪♬",
    0xAE: " ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ½⅓⅔¼¾⅛⅜⅝⅞№㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎨㎠㎡㎢㏊㎍㎎㎏㏏㎺㎻㎼㎽㎾㎿㎐㎑㎒㎓㎔",
    0xAF: " Ωohm㎂㎃㎄㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎨㎠㎡㎢㏊㎍㎎㎏㏏㎺㎻㎼㎽㎾㎿㎐㎑㎒㎓㎔＄％￦Ｆ′″℃Å￠￡￥¤℉‰℀℁℅℔№",

    // 일본어 히라가나 / 가타카나 영역 (Row 0xB0 ~ 0xB3)
    0xB0: " ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをん",
    0xB1: " ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデト doit どなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅ유ょよらりるれろゎわゐゑをんヴヵヶ",
    
    // 한자 영역 예시 (실제 DOS 조합형은 약 4,888자의 한자 매핑이 필요함)
    // 구조적 구현을 위해 대표적인 인덱스만 배열/객체 형태로 추가하여 관리합니다.
    0xC0: " 伽佳街可歌加價假架架駕刻脚各角閣却客脚갹", 
    0xC1: " 刊墾奸干懇揀杆柬澗癎看稈竿簡肝艮艱艱",
    // ... 실제 데이터에 맞춰 필요한 한자 행(0xC0 ~ 0xE9)을 추가 정의합니다.
},


    // convert.c 명세 내의 SGtbl (단독 자모음 51선)
    sgTable: [
        "ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
        "ㄲ","ㄸ","ㅃ","ㅆ","ㅉ","ㄳ","ㄵ","ㄶ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅄ",
        "ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"
    ],

    /**
     * 바이너리 버퍼에서 조합형 캐릭터 바이트 세그먼트를 읽어 유니코드로 복원합니다.
     */
    decode: function(buffer, offset, length) {
        const bytes = new Uint8Array(buffer, offset, length);
        let result = "";
        let i = 0;

        if(DEBUG) console.log(`%c[JohabDecoder] 디코딩 가동 - 오프셋: ${offset}, 길이: ${length}B`, "color: #00ffcc; font-weight: bold;");

        while (i < bytes.length) {
            if (bytes[i] === 0) { 
                i++; 
                continue; 
            }
            
            if ((bytes[i] & 0x80) === 0) {
                const asciiChar = String.fromCharCode(bytes[i]);
                if(DEBUG) console.log(`[단계: 아스크] 오프셋[${i}]: 0x${bytes[i].toString(16).toUpperCase()} -> '${asciiChar}'`);
                result += asciiChar;
                i++;
            } else {
                if (i + 1 < bytes.length) {
                    const b1 = bytes[i];
                    const b2 = bytes[i + 1]; 
                    const combinedWordCode = (b1 << 8) | b2;
                    const hexStr = combinedWordCode.toString(16).toUpperCase();

                    // 1. 그래픽 특수문자, 하트팩, 일본어 가나 맵 인터셉터 검사
                    if (this.graphicSymbolMap[combinedWordCode] !== undefined) {
                        const targetSymbol = this.graphicSymbolMap[combinedWordCode];
                        if(DEBUG) console.log(`%c[단계: 매핑 룩업1] 2바이트[${i}]: 0x${hexStr} -> 확장 변환 성공: '${targetSymbol}'`, "color: #ff9f43; font-weight: bold;");
                        result += targetSymbol;
                        i += 2;
                        continue;
                    }
					
        // 2. 그래픽문자 / 일본어 / 한자 영역 판별 (b2의 MSB가 1인 경우)
					/** /
        if (b2 >= 0x80) {
            // 상용 조합형 특수문자 행(Row) 인덱스 계산
            if (this.COMB_SPECIAL_MAP[b1]) {
				//console.log(b1.toString(16),b2.toString(16),this.COMB_SPECIAL_MAP[b1])
				console.log(b1.toString(16),b2.toString(16),'COMB_SPECIAL_MAP',this.COMB_SPECIAL_MAP[b1][b2 - 0x80])
                    if (this.COMB_SPECIAL_MAP[b1][b2 - 0x80] !== undefined) {
                        const targetSymbol = this.COMB_SPECIAL_MAP[b1][b2 - 0x80];
                        if(DEBUG) console.log(`%c[단계: 매핑 룩업2] 2바이트[${i}]: 0x${hexStr} -> 확장 변환 성공: '${targetSymbol}'`, "color: #ff9f43; font-weight: bold;");
                        result += targetSymbol;
                        i += 2;
                        continue;
                    }
            }
        }
					/**/

                    // 2. 삼벌식 무결성 수식 기반 초/중/종성 해체 주행 (고정 유지 사양)
                    let chosung = ((b1 >> 2) & 0x1F) - 2;
                    let jungsung = ((b1 & 0x03) << 3) | ((b2 >> 5) & 0x07);
                    let origJungsung = jungsung; 
                    
                    if (jungsung > 7 && jungsung < 16) {
                        jungsung -= 5;
                    } else if (jungsung > 15 && jungsung < 24) {
                        jungsung -= 7;
                    } else if (jungsung > 25) {
                        jungsung -= 9;
                    } else {
                        jungsung -= 3;
                    }

                    let jongsung = (b2 & 0x1F) - 1;
                    let origJongsung = jongsung; 
                    if (jongsung > 16) {
                        jongsung -= 1;
                    }

                    if (chosung >= 0 && jungsung >= 0 && jongsung >= 0) {
                        let unicode = chosung * 588 + jungsung * 28 + jongsung + 44032;
                        const finalChar = String.fromCharCode(unicode);
                        
                        if(DEBUG) console.log(`[단계: 한글 조합] 2바이트[${i}]: 0x${hexStr} -> 초성Idx:${chosung}, 중성(원본:${origJungsung}->보정:${jungsung}), 종성(원본:${origJongsung}->보정:${jongsung}) -> 유니코드:${unicode} ('${finalChar}')`);
                        result += finalChar;
                    } else {
                        // 3. convert.c의 SGtbl 예외 분기 검색
                        if (b1 === 0x84 || (combinedWordCode & 0xFC00) === 0x8400) {
                            const sgIndex = combinedWordCode & 0x00FF;
                            if (sgIndex >= 0x44 && sgIndex <= 0x7A) {
                                const lookupIdx = sgIndex - 0x44;
                                if (this.sgTable[lookupIdx]) {
                                    const sgChar = this.sgTable[lookupIdx];
                                    if(DEBUG) console.log(`%c[단계: SGtbl 자모] 2바이트[${i}]: 0x${hexStr} -> '${sgChar}'`, "color: #10ac84;");
                                    result += sgChar;
                                    i += 2;
                                    continue;
                                }
                            }
                        }
                        
                        // 4. 최후의 수단: EUC-KR 디코더 레이어 인터페이스 백업
                        const tempBytes = new Uint8Array([b1, b2]);
                        try {
                            const fallbackSymbol = new TextDecoder('euc-kr').decode(tempBytes);
                            if (fallbackSymbol && fallbackSymbol !== "") {
                                if(DEBUG) console.log(`%c[단계: 폴백 EUC-KR] 2바이트[${i}]: 0x${hexStr} -> 칩 해석: '${fallbackSymbol}'`, "color: #9c88ff;");
                                result += fallbackSymbol;
                            } else {
                                result += " ";
                            }
                        } catch (e) {
                            if(DEBUG) console.log(`%c[단계: 변환 실패] 2바이트[${i}]: 0x${hexStr} -> 공백 대체`, "color: #ff4757;");
                            result += " "; 
                        }
                    }

                    i += 2;
                } else {
                    i++;
                }
            }
        }
        
        if(DEBUG) console.log(`%c[JohabDecoder] 변환 완료: "${result}"`, "color: #00ffcc; font-weight: bold; border-top: 1px solid #00ffcc; padding-top: 2px;");
        //return result.trim(); 
		// 가사 앞에 공백이 있는 경우 위치 계산에 오류가 생기므로 trim() 하지 않는다.
        return result;
    }
};
