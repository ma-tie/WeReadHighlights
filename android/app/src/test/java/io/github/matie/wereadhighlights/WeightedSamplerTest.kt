package io.github.matie.wereadhighlights

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class WeightedSamplerTest {
    @Test fun respectsWeightIntervals() {
        assertEquals(0, WeightedSampler.pickIndex(listOf(1, 3), 0.10))
        assertEquals(1, WeightedSampler.pickIndex(listOf(1, 3), 0.25))
        assertEquals(1, WeightedSampler.pickIndex(listOf(1, 3), 0.99))
    }

    @Test fun ignoresNonPositiveEntries() {
        assertEquals(1, WeightedSampler.pickIndex(listOf(-1, 10, 0), 0.0))
        assertEquals(1, WeightedSampler.pickIndex(listOf(-1, 10, 0), 0.99))
    }

    @Test fun rejectsNoHighlights() {
        assertThrows(IllegalArgumentException::class.java) {
            WeightedSampler.pickIndex(listOf(0, 0))
        }
    }
}
