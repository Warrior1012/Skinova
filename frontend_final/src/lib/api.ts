export type Question = {
  id: string
  text: string
  type: 'single'
  options: string[]
  required?: boolean
}


export type PredictionDistributionItem = {
  code: string
  name: string
  score: number
}


export type UncertaintyInfo = {
  status: string
  reason: string
  top1_score?: number
  top2_score?: number
  margin?: number
}


export type ImageQuality = {
  quality:
    | 'good'
    | 'needs_improvement'

  quality_score: number

  blur_score: number

  sharpness_score?: number

  brightness: number

  brightness_score?: number

  resolution_score?: number

  resolution: {
    width: number
    height: number
  }

  issues: string[]
}


export type SafetyEscalation = {
  status:
    | 'LOWER PRIORITY'
    | 'REVIEW RECOMMENDED'
    | 'PRIORITY EVALUATION'
    | 'INSUFFICIENT INFORMATION'

  level:
    | 'lower'
    | 'moderate'
    | 'high'
    | 'uncertain'

  message: string

  signals: number

  signal_details?: string[]
}


export type AssessmentResult = {
  prediction: string

  confidence: number

  distribution:
    PredictionDistributionItem[]

  gradcamUrl?: string

  uncertainty?: UncertaintyInfo

  priority?:
    | 'Lower'
    | 'Moderate'
    | 'Higher'
    | 'Uncertain'

  urgency?: string

  explanation: string

  factors: string[]

  recommendations: string[]

  sources?: {
    title: string
    url?: string
  }[]

  pdfUrl?: string

  disclaimer?: string

  demo?: boolean

  imageQuality?: ImageQuality

  safetyEscalation?: SafetyEscalation

  aiSummary?: string
  doctorSummary?: DoctorReview
  agreement?: AgreementScore
}


export type HospitalPlace = {
  name: string
  address?: string
  distance?: string
  rating?: number
  type?: string
  url?: string
}


export type AIChatResponse = {
  language: 'hi' | 'en'
  reply: string
  summary?: string
}

export type DoctorReview = {
  doctor_name: string
  specialty?: string
  summary: string
  recommendation?: string
  created_at: string
}

export type AgreementScore = {
  score: number
  label: 'High agreement' | 'Moderate agreement' | 'Low agreement'
  dimensions: {
    assessment: number
    risk: number
    findings: number
    recommendation: number
  }
  explanation: string
  ai_generated: boolean
}

export type Medicine = {
  id: string
  name: string
  strength: string
  form: string
  price: number
  requires_prescription: boolean
  availability: 'in_stock' | 'out_of_stock'
  note?: string
}

export type MedicineOrder = {
  id: string
  items: Array<{ medicine_id: string; quantity: number }>
  total: number
  status: 'placed' | 'confirmed' | 'packed' | 'out_for_delivery' | 'delivered' | 'cancelled'
  address: string
  created_at: string
}

export type HomeConsultation = {
  id: string
  patient_name: string
  address: string
  date: string
  time: string
  reason: string
  status: 'requested' | 'doctor_assigned' | 'confirmed' | 'on_the_way' | 'completed' | 'cancelled'
  created_at: string
}

export type Consultation = {
  id: string
  assessment_id?: string
  patient_name: string
  doctor_name: string
  status: 'waiting' | 'active' | 'completed'
  created_at: string
}

export type ConsultationMessage = {
  id: string
  sender: 'patient' | 'doctor' | 'system'
  text: string
  language: 'hi' | 'en'
  created_at: string
}


const BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000'


const DEMO =
  String(
    import.meta.env.VITE_DEMO_MODE ??
      'false'
  ).toLowerCase() === 'true'


function absoluteApiUrl(
  path?: string | null
): string | undefined {

  if (!path) {
    return undefined
  }

  if (
    /^https?:\/\//i.test(path)
  ) {
    return path
  }

  const base =
    BASE.replace(/\/$/, '')

  return `${base}${
    path.startsWith('/')
      ? path
      : `/${path}`
  }`
}


// ==================================================
// GENERIC REQUEST
// ==================================================

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 60000
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE.replace(/\/$/, '')}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
    })

    if (!response.ok) {
      let message = `Request failed (${response.status})`
      try {
        const data = await response.json()
        if (data?.detail) {
          message = typeof data.detail === 'string'
            ? data.detail
            : JSON.stringify(data.detail)
        }
      } catch {
        // Keep the HTTP status fallback.
      }
      throw new Error(message)
    }

    return await response.json() as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}


// ==================================================
// START ASSESSMENT
// ==================================================

export async function startAssessment():
  Promise<{ id: string }> {

  if (DEMO) {

    return {
      id: crypto.randomUUID()
    }
  }

  const response =
    await request<{
      assessment_id: string
    }>(
      '/assessment/start',
      {
        method: 'POST'
      }
    )

  return {
    id: response.assessment_id
  }
}


// ==================================================
// IMAGE QUALITY
// ==================================================

export async function checkImageQuality(
  id: string,
  file: File
): Promise<ImageQuality> {

  if (DEMO) {

    return {
      quality: 'good',
      quality_score: 92,
      blur_score: 180,
      sharpness_score: 100,
      brightness: 128,
      brightness_score: 100,
      resolution_score: 100,
      resolution: {
        width: 1920,
        height: 1080
      },
      issues: []
    }
  }

  const formData =
    new FormData()

  formData.append(
    'file',
    file
  )

  return request<ImageQuality>(
    `/assessment/${encodeURIComponent(
      id
    )}/quality`,
    {
      method: 'POST',
      body: formData
    }
  )
}


// ==================================================
// UPLOAD IMAGE + ML
// ==================================================

export async function uploadImage(
  id: string,
  file: File
) {

  if (DEMO) {

    return {
      assessment_id: id
    }
  }

  const formData =
    new FormData()

  formData.append(
    'file',
    file
  )

  return request<{
    message: string

    ml_result: {
      class: string
      disease: string
      confidence: number

      distribution?:
        PredictionDistributionItem[]

      uncertainty?:
        UncertaintyInfo

      gradcam_path?:
        string | null
    }
  }>(
    `/assessment/${encodeURIComponent(
      id
    )}/image`,
    {
      method: 'POST',
      body: formData
    }
  )
}


// ==================================================
// GET AI QUESTIONS
// ==================================================

export async function getQuestions(
  id: string
): Promise<Question[]> {

  if (DEMO) {

    return [

      {
        id: 'duration',

        text:
          'How long have you noticed this lesion?',

        type: 'single',

        options: [
          'Less than 1 month',
          '1–6 months',
          'More than 6 months',
          'Not sure'
        ],

        required: true
      },

      {
        id: 'change',

        text:
          'Have you noticed any recent change in size, shape or colour?',

        type: 'single',

        options: [
          'Yes',
          'No',
          'Not sure'
        ],

        required: true
      },

      {
        id: 'bleeding',

        text:
          'Has the area bled or repeatedly crusted?',

        type: 'single',

        options: [
          'Yes',
          'No',
          'Not sure'
        ],

        required: true
      },

      {
        id: 'symptoms',

        text:
          'Have you noticed itching or pain?',

        type: 'single',

        options: [
          'Itching',
          'Pain',
          'Both',
          'Neither',
          'Not sure'
        ],

        required: true
      }
    ]
  }

  const response =
    await request<{
      questions:
        Array<{
          question_id: string
          question: string
          options: string[]
          category?: string
        }>
    }>(
      `/assessment/${encodeURIComponent(
        id
      )}/questions`
    )

  return response.questions.map(
    question => ({

      id:
        question.question_id,

      text:
        question.question,

      type:
        'single',

      options:
        question.options,

      required:
        true
    })
  )
}


// ==================================================
// SUBMIT ANSWERS
// ==================================================

export async function submitAnswers(
  id: string,
  answers: Record<string, string>
) {

  if (DEMO) {

    return {
      ok: true
    }
  }

  const responses = []

  for (
    const [
      questionId,
      answer
    ]
    of Object.entries(answers)
  ) {

    const response =
      await request<{
        message: string
        question_id: string
      }>(
        `/assessment/${encodeURIComponent(
          id
        )}/answer`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              question_id:
                questionId,

              answer
            })
        }
      )

    responses.push(
      response
    )
  }

  return {
    ok: true,
    responses
  }
}


// ==================================================
// FINAL RESULT
// ==================================================

export async function getResult(
  id: string
): Promise<AssessmentResult> {

  if (DEMO) {

    return {

      prediction: '',

      confidence: 0,

      distribution: [],

      explanation:
        'Demo mode is UI-only. Connect the FastAPI backend to run the real ML model and Gemini assessment.',

      factors: [
        'Uploaded image',
        'User-provided answers',
        'Backend ML prediction',
        'Retrieved medical information'
      ],

      recommendations: [
        'Connect the FastAPI backend for the real screening result.',
        'Use a clear, focused image of the affected area.',
        'Seek professional medical evaluation for concerning or changing lesions.'
      ],

      sources: [],

      demo: true
    }
  }

  const response =
    await request<{

      assessment: {

        screening_priority:
          string

        urgency:
          string

        summary:
          string

        explanation:
          string

        key_factors:
          string[]

        precautions:
          string[]

        recommendation:
          string

        disclaimer:
          string
      }

      ml_result?: {

        class:
          string

        disease:
          string

        confidence:
          number

        distribution?:
          PredictionDistributionItem[]

        uncertainty?:
          UncertaintyInfo
      }

      model_uncertainty?:
        UncertaintyInfo

      gradcam_url?:
        string | null

      medical_sources:
        Array<{
          id: string
          title: string
          score: number
          url?: string
        }>

      safety_escalation?:
        SafetyEscalation

      ai_summary?: string
      doctor_summary?: DoctorReview
      agreement?: AgreementScore

      image_quality?:
        ImageQuality

      pdf_available:
        boolean

      pdf_url:
        string

    }>(
      `/assessment/${encodeURIComponent(
        id
      )}/result`
    )

  // --------------------------------------------------
  // Priority mapping
  // --------------------------------------------------

  const priorityRaw =
    response.assessment
      .screening_priority
      .toLowerCase()

  let priority:
    | 'Lower'
    | 'Moderate'
    | 'Higher'
    | 'Uncertain' =
      'Uncertain'

  if (
    priorityRaw.includes(
      'higher'
    )
  ) {

    priority =
      'Higher'

  } else if (
    priorityRaw.includes(
      'moderate'
    )
  ) {

    priority =
      'Moderate'

  } else if (
    priorityRaw.includes(
      'lower'
    )
  ) {

    priority =
      'Lower'
  }

  // --------------------------------------------------
  // Prediction
  // --------------------------------------------------

  const prediction =
    response.ml_result?.disease ||
    response.ml_result?.class ||
    'Potential skin lesion'

  // --------------------------------------------------
  // Confidence
  // --------------------------------------------------

  let confidence =
    response.ml_result?.confidence ||
    0

  if (
    confidence > 0 &&
    confidence <= 1
  ) {

    confidence *= 100
  }

  // --------------------------------------------------
  // Distribution
  // --------------------------------------------------

  const distribution =
    response.ml_result
      ?.distribution || []

  // --------------------------------------------------
  // Return normalized result
  // --------------------------------------------------

  return {

    prediction,

    confidence,

    distribution,

    gradcamUrl:
      absoluteApiUrl(
        response.gradcam_url
      ),

    uncertainty:
      response.model_uncertainty ||
      response.ml_result
        ?.uncertainty,

    priority,

    urgency:
      response.assessment.urgency,

    explanation:
      response.assessment.explanation,

    factors:
      response.assessment
        .key_factors
        ?.length
        ? response.assessment
            .key_factors
        : [
            response.assessment
              .summary
          ],

    recommendations: [
      ...(
        response.assessment
          .precautions || []
      ),

      response.assessment
        .recommendation
    ],

    sources:
      response.medical_sources.map(
        source => ({
          title:
            source.title,

          url:
            source.url
        })
      ),

    pdfUrl:
      absoluteApiUrl(
        response.pdf_url
      ),

    disclaimer:
      response.assessment
        .disclaimer,

    imageQuality:
      response.image_quality,

    safetyEscalation:
      response.safety_escalation,

    aiSummary: response.ai_summary,
    doctorSummary: response.doctor_summary,
    agreement: response.agreement,

    demo: false
  }
}


// ==================================================
// NEARBY HOSPITALS / CLINICS
// ==================================================

export async function getHospitals():
  Promise<HospitalPlace[]> {

  if (DEMO) {
    return []
  }

  if (
    !navigator.geolocation
  ) {
    return []
  }

  try {

    const position =
      await new Promise<
        GeolocationPosition
      >(
        (
          resolve,
          reject
        ) => {

          navigator.geolocation
            .getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy:
                  true,

                timeout:
                  10000,

                maximumAge:
                  300000
              }
            )
        }
      )

    const lat =
      position.coords.latitude

    const lng =
      position.coords.longitude

    const response =
      await request<{
        places:
          HospitalPlace[]
      }>(
        `/assessment/hospitals?lat=${encodeURIComponent(
          lat
        )}&lng=${encodeURIComponent(
          lng
        )}`
      )

    return response.places || []

  } catch {

    return []
  }
}


// ==================================================
// PDF REPORT
// ==================================================

export function reportUrl(
  id: string
) {

  return (
    `${BASE}/assessment/` +
    `${encodeURIComponent(id)}` +
    `/report`
  )
}

// ==================================================
// MULTILINGUAL GEMINI CHAT
// ==================================================

export async function sendAIChat(
  message: string,
  language: 'hi' | 'en',
  assessmentId?: string
): Promise<AIChatResponse> {
  if (!message.trim()) throw new Error('Please enter a message.')
  return request<AIChatResponse>('/assessment/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language, assessment_id: assessmentId || null })
  }, 45000)
}

export async function submitDoctorSummary(
  assessmentId: string,
  payload: { doctor_name: string; specialty?: string; summary: string; recommendation?: string }
): Promise<DoctorReview> {
  return request<DoctorReview>(`/assessment/${encodeURIComponent(assessmentId)}/doctor-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function getAgreementScore(
  assessmentId: string
): Promise<AgreementScore> {
  return request<AgreementScore>(`/assessment/${encodeURIComponent(assessmentId)}/agreement`)
}

export async function getMedicines(search = ''): Promise<Medicine[]> {
  const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
  return request<{ medicines: Medicine[] }>(`/assessment/medicines${query}`).then(r => r.medicines)
}

export async function placeMedicineOrder(payload: {
  items: Array<{ medicine_id: string; quantity: number }>
  address: string
  assessment_id?: string
}): Promise<MedicineOrder> {
  return request<MedicineOrder>('/assessment/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function getMedicineOrder(orderId: string): Promise<MedicineOrder> {
  return request<MedicineOrder>(`/assessment/orders/${encodeURIComponent(orderId)}`)
}

export async function bookHomeConsultation(payload: {
  patient_name: string
  address: string
  date: string
  time: string
  reason: string
  assessment_id?: string
}): Promise<HomeConsultation> {
  return request<HomeConsultation>('/assessment/home-consultations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function createConsultation(payload: {
  patient_name: string
  doctor_name?: string
  assessment_id?: string
}): Promise<Consultation> {
  return request<Consultation>('/assessment/consultations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function getConsultationMessages(id: string): Promise<ConsultationMessage[]> {
  return request<{ messages: ConsultationMessage[] }>(`/assessment/consultations/${encodeURIComponent(id)}/messages`)
    .then(r => r.messages)
}

export async function sendConsultationMessage(
  id: string,
  payload: { sender: 'patient' | 'doctor'; text: string; language: 'hi' | 'en' }
): Promise<ConsultationMessage> {
  return request<ConsultationMessage>(`/assessment/consultations/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export function consultationWebSocketUrl(id: string): string {
  const base = BASE.replace(/\/$/, '')
  const wsBase = base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:')
  return `${wsBase}/ws/consultations/${encodeURIComponent(id)}`
}
