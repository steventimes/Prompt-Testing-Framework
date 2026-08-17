package com.promptframework.service;

import java.util.regex.Pattern;

/**
 * 解析模型裁判返回的质量分，避免从说明文字或非法数值中截取分数。
 */
public final class QualityScoreParser {

    // 必须是去除首尾空白后的完整 0..1 十进制；1 的小数部分只能为 0。
    private static final Pattern QUALITY_SCORE = Pattern.compile("^(?:0(?:\\.\\d+)?|1(?:\\.0+)?)$");

    public Double parse(String rawScore) {
        if (rawScore == null) {
            return null;
        }

        String normalizedScore = rawScore.strip();
        if (!QUALITY_SCORE.matcher(normalizedScore).matches()) {
            return null;
        }

        return Double.valueOf(normalizedScore);
    }
}
