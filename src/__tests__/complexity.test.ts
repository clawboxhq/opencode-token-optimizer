import { describe, expect, test } from "bun:test";
import { classifyComplexity, estimateTokens } from "../patterns/complexity.js";

describe("classifyComplexity", () => {
  describe("simple", () => {
    test("fix typo", () => {
      expect(classifyComplexity("fix typo in README")).toBe("simple");
    });

    test("rename", () => {
      expect(classifyComplexity("rename foo to bar")).toBe("simple");
    });

    test("update comment", () => {
      expect(classifyComplexity("update comment on line 5")).toBe("simple");
    });

    test("bump version", () => {
      expect(classifyComplexity("bump version to 2.0.0")).toBe("simple");
    });

    test("fix the broken test", () => {
      expect(classifyComplexity("fix the broken test")).toBe("simple");
    });

    test("delete unused file", () => {
      expect(classifyComplexity("delete unused file")).toBe("simple");
    });
  });

  describe("complex", () => {
    test("long prompt with analyze", () => {
      const prompt =
        "Analyze the entire authentication flow end-to-end, including OAuth, session management, and token refresh. Check for security vulnerabilities and performance bottlenecks across all services.";
      expect(classifyComplexity(prompt)).toBe("complex");
    });

    test("many file references", () => {
      const prompt =
        "Refactor src/auth.ts and src/session.ts and src/token.ts to share a common validation middleware";
      expect(classifyComplexity(prompt)).toBe("complex");
    });

    test("multiple question marks", () => {
      const prompt =
        "How does the caching layer work? What happens on cache miss? How is the cache invalidated?";
      expect(classifyComplexity(prompt)).toBe("complex");
    });

    test("architect prompt", () => {
      const prompt =
        "Design a new event-driven architecture for the notification system that scales to 10M events per day with horizontal scaling";
      expect(classifyComplexity(prompt)).toBe("complex");
    });

    test("investigate with file refs", () => {
      const prompt =
        "Investigate why src/api/handler.ts and src/db/queries.ts are causing slow response times and propose a fix";
      expect(classifyComplexity(prompt)).toBe("complex");
    });
  });

  describe("medium", () => {
    test("moderate length question", () => {
      const prompt =
        "Can you add a new endpoint to the API that returns user statistics for the last 30 days?";
      expect(classifyComplexity(prompt)).toBe("medium");
    });

    test("single file ref", () => {
      const prompt = "Update the validation logic in src/validators.ts to accept ISO date strings";
      expect(classifyComplexity(prompt)).toBe("medium");
    });

    test("ambiguous short prompt", () => {
      expect(classifyComplexity("make it better")).toBe("medium");
    });

    test("long prompt without complex signals", () => {
      const prompt =
        "Add a simple console log statement to the main entry point so we can see when the application starts up and shuts down properly";
      expect(classifyComplexity(prompt)).toBe("medium");
    });
  });

  describe("edge cases", () => {
    test("empty string", () => {
      expect(classifyComplexity("")).toBe("simple");
    });

    test("whitespace only", () => {
      expect(classifyComplexity("   ")).toBe("simple");
    });

    test("single character", () => {
      expect(classifyComplexity("x")).toBe("medium");
    });

    test("long prompt without complex signals", () => {
      const words = Array(200).fill("add");
      const prompt = words.join(" ");
      expect(classifyComplexity(prompt)).toBe("medium");
    });

    test("long prompt with complex signal", () => {
      const words = Array(200).fill("add");
      const prompt = "Analyze " + words.join(" ");
      expect(classifyComplexity(prompt)).toBe("complex");
    });

    test("exactly 500 chars", () => {
      const prompt = "x".repeat(500);
      expect(classifyComplexity(prompt)).toBe("medium");
    });

    test("over threshold with complex word", () => {
      const prompt = "investigate " + "x".repeat(500);
      expect(classifyComplexity(prompt)).toBe("complex");
    });
  });
});

describe("estimateTokens", () => {
  test("empty string → 0", () => {
    expect(estimateTokens("")).toBe(0);
  });

  test("whitespace only → 0", () => {
    expect(estimateTokens("   ")).toBe(0);
  });

  test("single word → 2", () => {
    expect(estimateTokens("hello")).toBe(2);
  });

  test("two words → 3", () => {
    expect(estimateTokens("hello world")).toBe(3);
  });

  test("10 words → 13", () => {
    const text = "one two three four five six seven eight nine ten";
    expect(estimateTokens(text)).toBe(13);
  });

  test("within 20% tolerance", () => {
    const text = "this is a test sentence with several words in it";
    const estimated = estimateTokens(text);
    expect(estimated).toBeGreaterThanOrEqual(10);
    expect(estimated).toBeLessThanOrEqual(16);
  });

  test("handles multiple spaces", () => {
    expect(estimateTokens("hello   world")).toBe(3);
  });

  test("handles leading/trailing whitespace", () => {
    expect(estimateTokens("  hello world  ")).toBe(3);
  });

  test("long text scales proportionally", () => {
    const words = Array(200).fill("word");
    const text = words.join(" ");
    expect(estimateTokens(text)).toBe(260);
  });
});
