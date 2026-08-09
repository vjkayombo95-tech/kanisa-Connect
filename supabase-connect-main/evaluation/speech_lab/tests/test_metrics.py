import unittest

from evaluation.speech_lab.metrics import BoundaryAccuracyCalculator, CERCalculator, WERCalculator
from evaluation.speech_lab.models import VerseBoundary


class MetricCalculatorTests(unittest.TestCase):
    def test_wer_calculator_normalizes_text(self):
        self.assertEqual(WERCalculator().calculate("Kwa maana Mungu", "kwa, maana mungu!"), 0)
        self.assertEqual(WERCalculator().calculate("kwa maana mungu", "kwa mungu"), 1 / 3)

    def test_cer_calculator_counts_character_edits(self):
        self.assertEqual(CERCalculator().calculate("abc", "abc"), 0)
        self.assertEqual(CERCalculator().calculate("abc", "adc"), 1 / 3)

    def test_boundary_accuracy_uses_tolerance(self):
        reference = [VerseBoundary(verse=1, start_ms=1000, end_ms=2000), VerseBoundary(verse=2, start_ms=2100, end_ms=3000)]
        hypothesis = [VerseBoundary(verse=1, start_ms=1100, end_ms=1900), VerseBoundary(verse=2, start_ms=2600, end_ms=3000)]

        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=250).calculate(reference, hypothesis), 0.5)


if __name__ == "__main__":
    unittest.main()
