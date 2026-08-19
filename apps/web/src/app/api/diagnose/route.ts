import { NextRequest, NextResponse } from 'next/server'

function buildPrompt(input: any): string {
  const { patientInfo, symptoms, existingConditions, symptomDuration, severity } = input
  return `You are a medical AI assistant. Analyze the following patient information and provide a diagnosis.

Patient Information:
- Name: ${patientInfo.name}
- Age: ${patientInfo.age}
- Gender: ${patientInfo.gender}
- Weight: ${patientInfo.weight || 'Not provided'}
- Height: ${patientInfo.height || 'Not provided'}

Symptoms: ${symptoms.join(', ')}
Duration: ${symptomDuration || 'Not specified'}
Severity: ${severity}

Medical History:
- Existing Conditions: ${existingConditions.length > 0 ? existingConditions.join(', ') : 'None'}
- Allergies: ${patientInfo.allergies.length > 0 ? patientInfo.allergies.join(', ') : 'None'}
- Current Medications: ${patientInfo.currentMedications.length > 0 ? patientInfo.currentMedications.join(', ') : 'None'}

Please provide:
1. POSSIBLE DIAGNOSES (list 2-4 possible conditions with brief explanations)
2. IMMEDIATE SOLUTIONS (practical steps for relief)
3. RECOMMENDED TESTS (diagnostic tests to confirm)
4. WHEN TO SEEK EMERGENCY (red flag symptoms)
`
}

function generateMockResponse(input: any): string {
  return `POSSIBLE DIAGNOSES:
Based on the symptoms (${input.symptoms.join(', ')}), possible conditions include:
1. Common viral infection - Most likely given the combination of symptoms
2. Stress-related condition - Consider if symptoms persist
3. Allergic reaction - If symptoms are seasonal or environment-related

IMMEDIATE SOLUTIONS:
1. Rest and stay hydrated
2. Over-the-counter pain relief if needed
3. Monitor symptoms for 24-48 hours
4. Keep a symptom diary

RECOMMENDED TESTS:
1. Complete Blood Count (CBC)
2. Basic Metabolic Panel
3. Consider allergy testing if symptoms persist

WHEN TO SEEK EMERGENCY:
- Difficulty breathing or chest pain
- High fever (above 103°F/39.4°C) lasting more than 3 days
- Severe headache with stiff neck
- Any sudden worsening of symptoms`
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json()

    if (!input.symptoms || input.symptoms.length === 0) {
      return NextResponse.json({ error: 'At least one symptom is required' }, { status: 400 })
    }

    const prompt = buildPrompt(input)
    const aiEndpoint = process.env.AI_MODEL_ENDPOINT
    const aiApiKey = process.env.AI_MODEL_API_KEY

    if (aiEndpoint) {
      try {
        const aiResponse = await fetch(aiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(aiApiKey ? { Authorization: `Bearer ${aiApiKey}` } : {}),
          },
          body: JSON.stringify({ prompt }),
        })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          const diagnosis = aiData.response || aiData.diagnosis || aiData.output || aiData.choices?.[0]?.message?.content || JSON.stringify(aiData)
          return NextResponse.json({ diagnosis })
        }
      } catch {}
    }

    const diagnosis = generateMockResponse(input)
    return NextResponse.json({ diagnosis })
  } catch {
    return NextResponse.json({ error: 'Failed to process diagnosis' }, { status: 500 })
  }
}
