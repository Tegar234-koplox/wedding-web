module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
        "total-byte-weight": ["error", { maxNumericValue: 1572864 }],
      },
    },
  },
};
