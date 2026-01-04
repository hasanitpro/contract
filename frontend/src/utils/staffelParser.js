// src/utils/staffelParser.js

export function parseStaffelSchedule(text) {
    if (!text || typeof text !== "string") return [];

    return text
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((entry) => {
            // Example: "ab 01.01.2027 +50 EUR"
            const match = entry.match(
                /ab\s+(\d{2}\.\d{2}\.\d{4}).*?(\d+)/i
            );

            if (!match) return null;

            const [, date, amount] = match;
            const [day, month, year] = date.split(".");

            return {
                ab: `${year}-${month}-${day}`,
                miete: amount,
            };
        })
        .filter(Boolean);
}
