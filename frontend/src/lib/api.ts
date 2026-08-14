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


export type AssessmentResult = {
  prediction: string
  confidence: number

  distribution: PredictionDistributionItem[]

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
}


export type HospitalPlace = {
  name: string
  address?: string
  distance?: string
  rating?: number
  type?: string
  url?: string
}


export type ImageQualityResult = {
  quality:
    | 'good'
    | 'needs_improvement'

  blur_score: number
  brightness: number
  width: number
  height: number

  issues: string[]
}


const BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000'


const DEMO =
  String(
    import.meta.env.VITE_DEMO_MODE ?? 'false'
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
  options: RequestInit = {}
): Promise<T> {

  const response = await fetch(
    `${BASE}${path}`,
    options
  )

  if (!response.ok) {

    let message =
      `Request failed (${response.status})`

    try {

      const data =
        await response.json()

      if (data?.detail) {

        message =
          typeof data.detail === 'string'
            ? data.detail
            : JSON.stringify(
                data.detail
              )
      }

    } catch {
      // Server returned a non-JSON error.
    }

    throw new Error(message)
  }

  return response.json()
}


// ==================================================
// START ASSESSMENT
// ==================================================

export async function startAssessment(): Promise<{
  id: string
}> {

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
// IMAGE QUALITY CHECK
// ==================================================

export async function checkImageQuality(
  id: string,
  file: File
): Promise<ImageQualityResult> {

  /*
   * Demo mode should not attempt a real backend call.
   * The UI still remains usable.
   */

  if (DEMO) {

    return {
      quality: 'good',
      blur_score: 150,
      brightness: 128,
      width: 224,
      height: 224,
      issues: []
    }
  }

  const formData =
    new FormData()

  formData.append(
    'file',
    file
  )

  return request<ImageQualityResult>(
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
      questions: Array<{
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
        'single' as const,

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

  const responses:
    Array<{
      message: string
      question_id: string
    }> = []


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

          body: JSON.stringify({
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
        'Demo mode is UI-only. Connect the FastAPI backend to run the real ML model and AI assessment.',

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

      disclaimer:
        'This tool is for screening and informational purposes only and does not provide a medical diagnosis.',

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

      pdf_available:
        boolean

      pdf_url:
        string
    }>(
      `/assessment/${encodeURIComponent(
        id
      )}/result`
    )


  // ------------------------------------------------
  // Screening priority
  // ------------------------------------------------

  const priorityRaw =
    String(
      response.assessment
        .screening_priority ?? ''
    ).toLowerCase()


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


  // ------------------------------------------------
  // Prediction
  // ------------------------------------------------

  const prediction =
    response.ml_result?.disease ||
    response.ml_result?.class ||
    'Potential skin lesion'


  let confidence =
    response.ml_result?.confidence ??
    0


  /*
   * Defensive handling in case backend
   * sends 0–1 instead of 0–100.
   */

  if (
    confidence > 0 &&
    confidence <= 1
  ) {

    confidence *= 100
  }


  const distribution =
    response.ml_result?.distribution ??
    []


  // ------------------------------------------------
  // Sources
  // ------------------------------------------------

  const sources =
    (
      response.medical_sources ??
      []
    ).map(
      source => ({
        title:
          source.title,

        url:
          source.url
      })
    )


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
      response.ml_result?.uncertainty,

    priority,

    urgency:
      response.assessment.urgency,

    explanation:
      response.assessment.explanation,

    factors:
      response.assessment.key_factors?.length
        ? response.assessment.key_factors
        : [
            response.assessment.summary
          ],

    recommendations: [
      ...(response.assessment
        .precautions ?? []),

      response.assessment
        .recommendation
    ],

    sources,

    pdfUrl:
      absoluteApiUrl(
        response.pdf_url
      ),

    disclaimer:
      response.assessment.disclaimer,

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
      await new Promise<GeolocationPosition>(
        (
          resolve,
          reject
        ) => {

          navigator.geolocation.getCurrentPosition(
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


    return (
      response.places ??
      []
    )

  } catch {

    /*
     * Location denied/unavailable OR
     * external healthcare service failed.
     *
     * The core screening result must
     * continue working.
     */

    return []
  }
}


// ==================================================
// PDF REPORT
// ==================================================

export function reportUrl(
  id: string
): string {

  return (
    `${BASE}/assessment/` +
    `${encodeURIComponent(id)}/report`
  )
}