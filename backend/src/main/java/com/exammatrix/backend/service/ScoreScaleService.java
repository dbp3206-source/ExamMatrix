package com.exammatrix.backend.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
public class ScoreScaleService {
    public static final BigDecimal SCALE_MAX = new BigDecimal("10.00");
    public static final BigDecimal HIGH_SCORE_THRESHOLD = new BigDecimal("8.00");
    private static final int DISPLAY_SCALE = 2;
    private static final int CALC_SCALE = 8;

    public BigDecimal calculateObjectiveScoreOnTen(int correctCount, int totalQuestions) {
        if (totalQuestions <= 0 || correctCount <= 0) {
            return BigDecimal.ZERO.setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
        }
        int clampedCorrect = Math.min(correctCount, totalQuestions);
        return BigDecimal.valueOf(clampedCorrect)
                .multiply(BigDecimal.TEN)
                .divide(BigDecimal.valueOf(totalQuestions), DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

    public List<BigDecimal> distributeEqualTenPoints(int questionCount) {
        if (questionCount <= 0) {
            return List.of();
        }
        List<BigDecimal> weights = new ArrayList<>(questionCount);
        for (int i = 0; i < questionCount; i++) {
            weights.add(BigDecimal.ONE);
        }
        return distributeWeightedTenPoints(weights);
    }

    public List<BigDecimal> distributeWeightedTenPoints(List<BigDecimal> weights) {
        if (weights == null || weights.isEmpty()) {
            return List.of();
        }
        BigDecimal totalWeight = BigDecimal.ZERO;
        for (BigDecimal w : weights) {
            BigDecimal positive = (w != null && w.compareTo(BigDecimal.ZERO) > 0) ? w : BigDecimal.ONE;
            totalWeight = totalWeight.add(positive);
        }
        if (totalWeight.compareTo(BigDecimal.ZERO) <= 0) {
            return distributeEqualTenPoints(weights.size());
        }

        List<BigDecimal> distributed = new ArrayList<>(weights.size());
        BigDecimal runningSum = BigDecimal.ZERO;
        for (int i = 0; i < weights.size(); i++) {
            BigDecimal w = (weights.get(i) != null && weights.get(i).compareTo(BigDecimal.ZERO) > 0)
                    ? weights.get(i)
                    : BigDecimal.ONE;
            if (i == weights.size() - 1) {
                BigDecimal last = SCALE_MAX.subtract(runningSum).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
                if (last.compareTo(BigDecimal.ZERO) < 0) {
                    last = BigDecimal.ZERO.setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
                }
                distributed.add(last);
            } else {
                BigDecimal pts = w.multiply(BigDecimal.TEN)
                        .divide(totalWeight, DISPLAY_SCALE, RoundingMode.DOWN);
                distributed.add(pts);
                runningSum = runningSum.add(pts);
            }
        }
        return distributed;
    }

    public BigDecimal normalizeToTen(BigDecimal rawScore, BigDecimal maxScore, BigDecimal persistedScoreOnTen) {
        if (persistedScoreOnTen != null) {
            return clampToTen(persistedScoreOnTen);
        }
        if (rawScore == null || maxScore == null || maxScore.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        if (rawScore.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
        }

        if (maxScore.compareTo(BigDecimal.TEN) == 0) {
            return clampToTen(rawScore);
        }
        BigDecimal scaled = rawScore.multiply(BigDecimal.TEN)
                .divide(maxScore, CALC_SCALE, RoundingMode.HALF_UP)
                .setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
        return clampToTen(scaled);
    }

    public BigDecimal clampToTen(BigDecimal value) {
        if (value == null) return null;
        BigDecimal rounded = value.setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
        if (rounded.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
        }
        if (rounded.compareTo(SCALE_MAX) > 0) {
            return SCALE_MAX;
        }
        return rounded;
    }

    public boolean isHighScore(BigDecimal scoreOnTen) {
        return scoreOnTen != null && scoreOnTen.compareTo(HIGH_SCORE_THRESHOLD) >= 0;
    }
}
