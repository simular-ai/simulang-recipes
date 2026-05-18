#include <algorithm>
#include <chrono>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <random>
#include <vector>

// ── Sorting implementations ──────────────────────────────────────────────────

void bubbleSort(std::vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n - 1; ++i)
        for (int j = 0; j < n - i - 1; ++j)
            if (arr[j] > arr[j + 1])
                std::swap(arr[j], arr[j + 1]);
}

void mergeSort(std::vector<int>& arr, int l, int r) {
    if (l >= r) return;
    int m = l + (r - l) / 2;
    mergeSort(arr, l, m);
    mergeSort(arr, m + 1, r);
    std::vector<int> tmp;
    int i = l, j = m + 1;
    while (i <= m && j <= r)
        tmp.push_back(arr[i] <= arr[j] ? arr[i++] : arr[j++]);
    while (i <= m) tmp.push_back(arr[i++]);
    while (j <= r) tmp.push_back(arr[j++]);
    std::copy(tmp.begin(), tmp.end(), arr.begin() + l);
}

// ── Timing helper ────────────────────────────────────────────────────────────

using Clock = std::chrono::high_resolution_clock;

template<typename Fn>
double timeMs(Fn fn, std::vector<int> data) {
    auto start = Clock::now();
    fn(data);
    auto end   = Clock::now();
    return std::chrono::duration<double, std::milli>(end - start).count();
}

// ── Main ──────────────────────────────────────────────────────────────────────

int main() {
    const std::vector<int> SIZES = {1000, 5000, 10000, 50000};
    const int RUNS = 3;  // average over N runs for stability

    // Header
    std::cout << std::left
              << std::setw(10) << "Size"
              << std::setw(18) << "BubbleSort (ms)"
              << std::setw(18) << "MergeSort (ms)"
              << std::setw(18) << "std::sort (ms)"
              << "\n";
    std::cout << std::string(64, '-') << "\n";

    for (int sz : SIZES) {
        // Generate a fixed random array to keep comparisons fair
        std::vector<int> base(sz);
        std::iota(base.begin(), base.end(), 0);
        std::srand(42);
        std::shuffle(base.begin(), base.end(), std::mt19937(42));

        double tBubble = 0, tMerge = 0, tStd = 0;

        for (int r = 0; r < RUNS; ++r) {
            tBubble += timeMs([](std::vector<int> v){ bubbleSort(v); }, base);

            tMerge += timeMs([](std::vector<int> v){ mergeSort(v, 0, (int)v.size()-1); }, base);
            tStd   += timeMs([](std::vector<int> v){ std::sort(v.begin(), v.end()); }, base);
        }

        std::cout << std::left << std::fixed << std::setprecision(3)
                  << std::setw(10) << sz
                  << std::setw(18) << tBubble / RUNS
                  << std::setw(18) << tMerge  / RUNS
                  << std::setw(18) << tStd    / RUNS
                  << "\n";
    }

    return 0;
}
