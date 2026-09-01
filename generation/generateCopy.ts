export async function generateOutreachCopy(lead: {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  channel?: "sms" | "voice" | "email";
  timezone?: string;
  [key: string]: any;
}): Promise<{ subject?: string; body: string; channel: string }> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable for copy generation.");
  }

  const channel = lead.channel ?? "email";
  const leadName = lead.name ?? "there";
  const email = lead.email ?? "";
  const phone = lead.phone ?? "";

  let systemPrompt = "You are a helpful sales outreach assistant. Generate concise outreach copy tailored to the lead.";
  let userPrompt = "";

  if (channel === "email") {
    systemPrompt += " Keep it short, polished, and businesslike. Output a subject line and 2-3 sentence body.";
    userPrompt = `Write a short personalized outreach email for ${leadName}. Lead email: ${email}. Keep it professional and concise. Return JSON with keys: subject and body.`;
  } else if (channel === "sms") {
    systemPrompt += " Keep it under 160 characters and natural. Output one message only as the body.";
    userPrompt = `Write a personalized SMS for ${leadName}. Lead phone: ${phone}. Keep it brief and under 160 characters. Return JSON with key: body.`;
  } else {
    systemPrompt += " Keep it to 2-3 sentences and sound like a short sales talk track opener.";
    userPrompt = `Write a short voice outreach opener for ${leadName}. Lead phone: ${phone}. Keep it conversational and natural. Return JSON with key: body.`;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API request failed (${response.status} ${response.statusText}): ${errorText || "No error details returned"}`);
    }

    const data = await response.json() as any;
    const content = data?.choices?.[0]?.message?.content ?? "";

    if (!content) {
      throw new Error("OpenAI API returned an empty response for outreach copy generation.");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { body: content.trim() };
    }

    if (channel === "email") {
      return {
        subject: parsed.subject ?? `Quick follow-up for ${leadName}`,
        body: parsed.body ?? content.trim(),
        channel
      };
    }

    return {
      body: parsed.body ?? content.trim(),
      channel
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate outreach copy for ${leadName}: ${error.message}`);
    }

    throw new Error(`Failed to generate outreach copy for ${leadName}: Unknown error`);
  }
}
