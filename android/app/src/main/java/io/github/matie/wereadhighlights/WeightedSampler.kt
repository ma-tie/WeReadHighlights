package io.github.matie.wereadhighlights

import kotlin.random.Random

/** Pick one item proportionally to its non-negative weight. */
internal object WeightedSampler {
    fun pickIndex(weights: List<Int>, unitRandom: Double = Random.nextDouble()): Int {
        require(weights.isNotEmpty()) { "没有可选的书籍" }
        require(unitRandom in 0.0..1.0 && !unitRandom.isNaN()) { "随机数必须在 [0,1] 内" }
        val total = weights.sumOf { it.coerceAtLeast(0).toLong() }
        require(total > 0L) { "没有找到可以随机抽取的划线" }
        var target = unitRandom.coerceAtMost(Math.nextDown(1.0)) * total
        weights.forEachIndexed { index, count ->
            target -= count.coerceAtLeast(0)
            if (target < 0) return index
        }
        return weights.lastIndex
    }
}
