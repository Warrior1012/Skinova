import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { UploadCloud } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CircleHelp,
  FileDown,
  FileImage,
  HeartPulse,
  Hospital,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  Code2,
  ExternalLink,
  MessageCircle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  ShoppingCart,
  Home as HomeIcon,
  Languages,
  Bot,
  UserRound,
  ClipboardCheck,
  PackageCheck,
  Truck,
  CalendarDays
} from 'lucide-react'

import {
  getHospitals,
  getQuestions,
  getResult,
  reportUrl,
  startAssessment,
  submitAnswers,
  uploadImage,
  checkImageQuality,
  sendAIChat,
  submitDoctorSummary,
  getAgreementScore,
  getMedicines,
  placeMedicineOrder,
  bookHomeConsultation,
  createConsultation,
  getConsultationMessages,
  sendConsultationMessage,
  consultationWebSocketUrl,
  type AssessmentResult,
  type Question,
  type ImageQuality,
  type AgreementScore,
  type Medicine,
  type MedicineOrder,
  type HomeConsultation,
  type Consultation,
  type ConsultationMessage
} from './lib/api'


type Step =
  | 'home'
  | 'upload'
  | 'preview'
  | 'analysis'
  | 'questions'
  | 'processing'
  | 'result'


type Place = {
  name: string
  rating?: number
  distance?: string
  address?: string
  url?: string
}


type CaseHistoryItem = {
  id: string
  date: string
  prediction: string
  confidence: number
  priority: string
  safetyStatus?: string
}


const steps = [
  'Upload',
  'Questions',
  'Analysis',
  'Results'
]


const demoHeroImage =
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/Nevus.jpg'


const HISTORY_KEY =
  'skinova_assessment_history'


// ============================================================
// CASE HISTORY HELPERS
// ============================================================

function loadCaseHistory():
  CaseHistoryItem[] {

  try {

    const raw =
      localStorage.getItem(
        HISTORY_KEY
      )

    if (!raw) {
      return []
    }

    const parsed =
      JSON.parse(raw)

    if (
      !Array.isArray(parsed)
    ) {
      return []
    }

    return parsed

  } catch {

    return []
  }
}


function saveCaseHistory(
  item: CaseHistoryItem
) {

  try {

    const existing =
      loadCaseHistory()

    const updated = [
      item,
      ...existing.filter(
        existingItem =>
          existingItem.id !== item.id
      )
    ].slice(0, 10)

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        updated
      )
    )

  } catch {
    // History is optional.
    // Never break the medical assessment.
  }
}


// ============================================================
// LOGO
// ============================================================

function Logo() {

  return (
    <div className="flex items-center gap-2">

      <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-brand ring-1 ring-emerald-100">

        <Sparkles size={18} />

      </div>

      <span className="text-lg font-bold tracking-tight text-slate-900">
        Skinova
      </span>

    </div>
  )
}


// ============================================================
// MAIN APP
// ============================================================

export default function App() {

  const [
    step,
    setStep
  ] = useState<Step>('home')

  const [
    assessmentId,
    setAssessmentId
  ] = useState('')

  const [
    file,
    setFile
  ] = useState<File | null>(null)

  const [
    preview,
    setPreview
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  const [
    busy,
    setBusy
  ] = useState(false)

  const [
    questions,
    setQuestions
  ] = useState<Question[]>([])

  const [
    answers,
    setAnswers
  ] = useState<
    Record<string, string>
  >({})

  const [
    result,
    setResult
  ] = useState<
    AssessmentResult | null
  >(null)

  const [
    places,
    setPlaces
  ] = useState<Place[]>([])

  const [
    imageQuality,
    setImageQuality
  ] = useState<ImageQuality | null>(
    null
  )

  const [
    history,
    setHistory
  ] = useState<
    CaseHistoryItem[]
  >(
    () => loadCaseHistory()
  )


  useEffect(
    () => {

      return () => {

        if (preview) {
          URL.revokeObjectURL(
            preview
          )
        }

      }

    },
    [preview]
  )


  const currentIndex =
    useMemo(
      () =>
        step === 'home'
          ? -1
          : step === 'upload' ||
            step === 'preview'
          ? 0
          : step === 'questions'
          ? 1
          : step === 'analysis' ||
            step === 'processing'
          ? 2
          : 3,
      [step]
    )


  // ==========================================================
  // START
  // ==========================================================

  const start = async () => {

    setError('')
    setBusy(true)

    setFile(null)
    setPreview('')

    setQuestions([])
    setAnswers({})

    setResult(null)
    setPlaces([])

    setImageQuality(null)

    setHistory(
      loadCaseHistory()
    )

    try {

      const r =
        await startAssessment()

      setAssessmentId(
        r.id
      )

      setStep('upload')

    } catch (error) {

      console.error(error)

      setError(
        error instanceof Error
          ? error.message
          : (
              'Unable to start the assessment. '
              + 'Please try again.'
            )
      )

    } finally {

      setBusy(false)
    }
  }


  // ==========================================================
  // CHOOSE FILE
  // ==========================================================

  const chooseFile = (
    f: File | null
  ) => {

    setError('')

    if (!f) {
      return
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ]

    if (
      !allowed.includes(
        f.type
      )
    ) {

      setError(
        'Please upload a supported image format: JPG, JPEG, PNG or WebP.'
      )

      return
    }

    if (
      f.size >
      10 * 1024 * 1024
    ) {

      setError(
        'Please upload an image smaller than 10 MB.'
      )

      return
    }

    if (preview) {
      URL.revokeObjectURL(
        preview
      )
    }

    setFile(f)

    setPreview(
      URL.createObjectURL(f)
    )

    setQuestions([])
    setAnswers({})
    setResult(null)
    setImageQuality(null)

    setStep('preview')
  }


  // ==========================================================
  // QUALITY + UPLOAD + QUESTIONS
  // ==========================================================

  const handleUpload =
    async () => {

      if (
        !file ||
        !assessmentId
      ) {

        setError(
          'Assessment session is missing. Please start a new assessment.'
        )

        return
      }

      setBusy(true)
      setError('')
      setStep('analysis')

      try {

        // ----------------------------------------------------
        // STEP 1 — IMAGE QUALITY
        // ----------------------------------------------------

        const quality =
          await checkImageQuality(
            assessmentId,
            file
          )

        setImageQuality(
          quality
        )

        // ----------------------------------------------------
        // QUALITY GATE
        // ----------------------------------------------------

        if (
          quality.quality ===
          'needs_improvement'
        ) {

          setError(
            `Image quality needs improvement. ${
              quality.issues.length
                ? quality.issues.join(' ')
                : 'Please upload a clearer image.'
            }`
          )

          setStep(
            'preview'
          )

          return
        }

        // ----------------------------------------------------
        // STEP 2 — ML
        // ----------------------------------------------------

        await uploadImage(
          assessmentId,
          file
        )

        // ----------------------------------------------------
        // STEP 3 — GEMINI QUESTIONS
        // ----------------------------------------------------

        const qs =
          await getQuestions(
            assessmentId
          )

        if (
          !qs.length
        ) {

          throw new Error(
            'The AI service returned no assessment questions.'
          )
        }

        setQuestions(
          qs
        )

        setAnswers({})

        setStep(
          'questions'
        )

      } catch (error) {

        console.error(error)

        setError(
          error instanceof Error
            ? error.message
            : (
                'Unable to upload or analyze the image. '
                + 'Please try again.'
              )
        )

        setStep(
          'preview'
        )

      } finally {

        setBusy(false)
      }
    }


  // ==========================================================
  // ANSWER
  // ==========================================================

  const answerQuestion = (
    q: Question,
    value: string
  ) => {

    setAnswers(
      current => ({
        ...current,
        [q.id]: value
      })
    )
  }


  // ==========================================================
  // FINISH QUESTIONS
  // ==========================================================

  const finishQuestions =
    async () => {

      const missing =
        questions.some(
          q =>
            q.required &&
            !answers[
              q.id
            ]?.trim()
        )

      if (missing) {

        setError(
          'Please answer the required question before continuing.'
        )

        return
      }

      setBusy(true)
      setError('')

      try {

        await submitAnswers(
          assessmentId,
          answers
        )

        setStep(
          'processing'
        )

        const r =
          await getResult(
            assessmentId
          )

        setResult(r)

        // ----------------------------------------------------
        // SAVE CASE HISTORY
        // ----------------------------------------------------

        const historyItem:
          CaseHistoryItem = {

          id:
            assessmentId,

          date:
            new Date()
              .toISOString(),

          prediction:
            r.prediction,

          confidence:
            r.confidence,

          priority:
            r.priority ||
            'Uncertain',

          safetyStatus:
            r.safetyEscalation
              ?.status
        }

        saveCaseHistory(
          historyItem
        )

        setHistory(
          loadCaseHistory()
        )

        // ----------------------------------------------------
        // NEARBY CARE
        // ----------------------------------------------------

        try {

          const nearbyPlaces =
            await getHospitals()

          setPlaces(
            nearbyPlaces
          )

        } catch {

          setPlaces([])
        }

        setStep(
          'result'
        )

      } catch (error) {

        console.error(error)

        setError(
          error instanceof Error
            ? error.message
            : (
                'Assessment could not be completed. '
                + 'Please try again.'
              )
        )

        setStep(
          'questions'
        )

      } finally {

        setBusy(false)
      }
    }


  // ==========================================================
  // RESET
  // ==========================================================

  const reset = () => {

    if (preview) {
      URL.revokeObjectURL(
        preview
      )
    }

    setStep('home')

    setFile(null)
    setPreview('')

    setError('')

    setResult(null)

    setQuestions([])
    setAnswers({})

    setPlaces([])

    setAssessmentId('')

    setImageQuality(null)

    setHistory(
      loadCaseHistory()
    )

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="min-h-screen bg-soft text-ink">

      <Header
        step={step}
        onHome={reset}
      />

      {step !== 'home' && (
        <Progress
          current={
            currentIndex
          }
        />
      )}

      <main className="container-app py-8 sm:py-12">

        {error && (

          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

            <CircleAlert
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
              {error}
            </div>

            <button
              onClick={() =>
                setError('')
              }
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>

          </div>
        )}

        {step === 'home' && (

          <Home
            onStart={start}
            busy={busy}
            history={history}
          />

        )}

        {step === 'upload' && (

          <UploadPage
            onFile={chooseFile}
            onBack={reset}
          />

        )}

        {step === 'preview' && (

          <PreviewPage
            file={file}
            preview={preview}
            onReplace={() =>
              setStep('upload')
            }
            onContinue={
              handleUpload
            }
            busy={busy}
          />

        )}

        {step === 'analysis' && (

          <AnalysisPage
            text="Analyzing your image"
            detail="Checking image quality and processing the uploaded image."
          />

        )}

        {step === 'questions' && (

          <QuestionsPage
            questions={questions}
            answers={answers}
            onAnswer={
              answerQuestion
            }
            onBack={() =>
              setStep('preview')
            }
            onNext={
              finishQuestions
            }
            busy={busy}
          />

        )}

        {step === 'processing' && (

          <AnalysisPage
            text="Preparing your screening summary"
            detail="Combining image analysis with your answers and available evidence."
          />

        )}

        {step === 'result' &&
          result && (

            <ResultPage
              result={result}
              places={places}
              report={
                reportUrl(
                  assessmentId
                )
              }
              imageQuality={
                imageQuality
              }
              assessmentId={assessmentId}
              history={history}
              onStartOver={
                reset
              }
            />

          )}

      </main>

      <Footer />

    </div>
  )
}


// ============================================================
// HEADER
// ============================================================

function Header({
  step,
  onHome
}: {
  step: Step
  onHome: () => void
}) {

  return (

    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">

      <div className="container-app flex min-h-16 items-center justify-between gap-6">

        <button
          onClick={onHome}
          aria-label="Skinova home"
        >
          <Logo />
        </button>

        <nav className="hidden items-center gap-7 md:flex">

          <a
            href="#about"
            className="nav-link"
          >
            About
          </a>

          <a
            href="#technology"
            className="nav-link"
          >
            Technology
          </a>

          <a
            href="#faqs"
            className="nav-link"
          >
            FAQs
          </a>

        </nav>

        <div className="flex items-center gap-2">

          {step !== 'home' && (

            <button
              onClick={onHome}
              className="btn-secondary px-3 py-2 text-sm"
            >
              <RefreshCw
                size={15}
              />
              New
            </button>

          )}

          {step === 'home' && (

            <button
              onClick={() =>
                document
                  .getElementById(
                    'about'
                  )
                  ?.scrollIntoView({
                    behavior:
                      'smooth'
                  })
              }
              className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Learn more
            </button>

          )}

        </div>

      </div>

    </header>
  )
}


// ============================================================
// PROGRESS
// ============================================================

function Progress({
  current
}: {
  current: number
}) {

  return (

    <div className="border-b border-slate-200 bg-white">

      <div className="container-app flex items-center gap-2 py-3">

        {steps.map(
          (
            stepName,
            index
          ) => (

            <div
              key={stepName}
              className="flex flex-1 items-center gap-2 text-xs font-semibold sm:text-sm"
            >

              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  index <= current
                    ? 'bg-brand text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >

                {index < current ? (
                  <Check
                    size={14}
                  />
                ) : (
                  index + 1
                )}

              </div>

              <span
                className={
                  index <= current
                    ? 'text-slate-800'
                    : 'text-slate-400'
                }
              >
                {stepName}
              </span>

              {index <
                steps.length - 1 && (

                <div
                  className={`h-px flex-1 ${
                    index < current
                      ? 'bg-brand'
                      : 'bg-slate-200'
                  }`}
                />

              )}

            </div>

          )
        )}

      </div>

    </div>
  )
}


// ============================================================
// HOME
// ============================================================

function Home({
  onStart,
  busy,
  history
}: {
  onStart: () => void
  busy: boolean
  history: CaseHistoryItem[]
}) {

  return (

    <div>

      <section className="grid items-center gap-12 py-8 lg:grid-cols-[1.03fr_.97fr] lg:py-14">

        <div>

          <div className="eyebrow mb-5 flex items-center gap-2">
            <Sparkles
              size={14}
            />
            AI-assisted skin lesion screening
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-.045em] text-slate-900 sm:text-6xl">

            Smarter screening.
            <br />

            <span className="text-brand">
              Better next steps.
            </span>

          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">

            Upload a skin image, answer a few relevant questions,
            and receive an AI-assisted screening summary with
            evidence-based information and recommended next steps.

          </p>

          <div className="mt-8 flex flex-wrap gap-3">

            <button
              className="btn-primary"
              onClick={onStart}
              disabled={busy}
            >

              {busy ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : null}

              Start Assessment

              <ArrowRight
                size={17}
              />

            </button>

          </div>

          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">

            <Feature
              icon={
                <ShieldCheck
                  size={17}
                />
              }
              title="Screening support"
            />

            <Feature
              icon={
                <HeartPulse
                  size={17}
                />
              }
              title="Personalized context"
            />

            <Feature
              icon={
                <Hospital
                  size={17}
                />
              }
              title="Nearby care"
            />

          </div>

        </div>


        <div className="card overflow-hidden p-3">

          <div className="relative overflow-hidden rounded-[1.4rem] bg-slate-50">

            <img
              src={demoHeroImage}
              alt="Clinical example of a skin nevus"
              className="h-[420px] w-full object-cover"
            />

            <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg backdrop-blur">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <p className="text-sm font-bold text-slate-900">
                    Clinical image example
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Public-domain reference image.
                    Uploaded user images are analyzed
                    only after the assessment begins.
                  </p>

                </div>

                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-brand">
                  Reference
                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      <section
        id="about"
        className="scroll-mt-24 border-t border-slate-200 py-14 sm:py-16"
      >

        <div className="grid gap-10 lg:grid-cols-[.65fr_1.35fr]">

          <div>

            <p className="eyebrow">
              About Skinova
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              A focused screening assistant,
              not a diagnosis tool.
            </h2>

          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            <InfoCard
              title="What it does"
              text="Combines an image-classification model with structured questions and evidence retrieval to organize screening information."
            />

            <InfoCard
              title="What it does not do"
              text="It does not confirm a disease, replace a clinician, or turn model confidence into a cancer-risk percentage."
            />

            <InfoCard
              title="Designed for the MVP"
              text="The journey stays intentionally small: image, questions, analysis, summary, care options and a downloadable PDF."
            />

            <InfoCard
              title="Privacy-minded flow"
              text="No account, profile, social sharing or unnecessary data collection is required for the prototype."
            />

          </div>

        </div>

      </section>


      <section
        id="technology"
        className="scroll-mt-24 border-t border-slate-200 py-14 sm:py-16"
      >

        <div className="flex flex-wrap items-end justify-between gap-5">

          <div>

            <p className="eyebrow">
              Technology
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Built around a simple AI pipeline.
            </h2>

          </div>

          <Code2
            className="text-brand"
            size={30}
          />

        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {[
            [
              'Frontend',
              'React · TypeScript · Tailwind CSS'
            ],
            [
              'Backend',
              'FastAPI · Python'
            ],
            [
              'Vision',
              'TensorFlow · Keras · EfficientNetB0'
            ],
            [
              'Intelligence',
              'Gemini · RAG · Structured Outputs'
            ]
          ].map(
            ([title, text]) => (

              <div
                key={title}
                className="card p-5"
              >

                <p className="font-semibold text-slate-900">
                  {title}
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {text}
                </p>

              </div>

            )
          )}

        </div>

      </section>


      <section
        id="faqs"
        className="scroll-mt-24 border-t border-slate-200 py-14 sm:py-16"
      >

        <div className="grid gap-8 lg:grid-cols-[.6fr_1.4fr]">

          <div>

            <p className="eyebrow">
              FAQs
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Quick answers before you start.
            </h2>

          </div>

          <div className="grid gap-3">

            {[
              [
                'Is this a medical diagnosis?',
                'No. Skinova is a screening and informational prototype. A qualified healthcare professional should evaluate concerning or changing lesions.'
              ],

              [
                'What image formats are supported?',
                'JPG, JPEG, PNG and WebP images up to 10 MB are supported in the upload flow.'
              ],

              [
                'What does model confidence mean?',
                'It is the model’s confidence in its predicted class. It is not diagnostic accuracy and it is not a cancer-risk percentage.'
              ],

              [
                'Can I use a random photo or signature?',
                'The frontend validates that the file is an image, while the backend and ML pipeline determine whether the image can actually be analyzed.'
              ],

              [
                'Where do nearby clinics come from?',
                'Nearby healthcare locations are retrieved through the backend healthcare search endpoint. The language model should never invent clinic names.'
              ],

              [
                'Can I download the summary?',
                'Yes. The Download Screening Summary button is wired to the backend report endpoint and opens the generated PDF.'
              ]
            ].map(
              ([q, a]) => (

                <details
                  key={q}
                  className="card group p-5"
                >

                  <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-slate-900">

                    <CircleHelp
                      size={18}
                      className="text-brand"
                    />

                    {q}

                    <span className="ml-auto text-slate-400 transition group-open:rotate-45">
                      +
                    </span>

                  </summary>

                  <p className="mt-3 pl-7 text-sm leading-6 text-slate-600">
                    {a}
                  </p>

                </details>

              )
            )}

          </div>

        </div>

      </section>


      {/* ======================================================
          CASE MEMORY
      ====================================================== */}

      {history.length > 0 && (

        <section className="border-t border-slate-200 py-14 sm:py-16">

          <div className="flex items-end justify-between gap-4">

            <div>

              <p className="eyebrow">
                Assessment history
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Your Skinova Timeline
              </h2>

              <p className="mt-2 max-w-2xl text-slate-500">
                Previous screening summaries stored locally
                in this browser.
              </p>

            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">

              {history.length}
              {' '}
              case
              {history.length === 1
                ? ''
                : 's'}

            </span>

          </div>


          <div className="mt-7 space-y-3">

            {history.map(
              (
                item,
                index
              ) => (

                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-start gap-4">

                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-brand">
                        {index + 1}
                      </div>

                      <div>

                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {new Date(
                            item.date
                          ).toLocaleDateString()}
                        </p>

                        <h3 className="mt-1 font-semibold text-slate-900">
                          {item.prediction}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Model output:{' '}
                          {item.confidence.toFixed(
                            1
                          )}
                          %
                        </p>

                      </div>

                    </div>


                    <div className="flex flex-wrap gap-2">

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {item.priority}
                      </span>

                      {item.safetyStatus && (

                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                          {item.safetyStatus}
                        </span>

                      )}

                    </div>

                  </div>

                </div>

              )
            )}

          </div>

        </section>

      )}


      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">

        <b>Important:</b>{' '}
        This tool is for screening and informational
        purposes only. It does not provide a medical
        diagnosis or replace evaluation by a qualified
        healthcare professional.

      </div>


      <p className="mt-3 text-xs text-slate-400">

        Hero reference image: Wikimedia Commons,
        public-domain nevus image.

        {' '}

        <a
          className="font-semibold text-brand underline"
          href="https://commons.wikimedia.org/wiki/File:Nevus.jpg"
          target="_blank"
          rel="noreferrer"
        >
          View source
        </a>

      </p>

    </div>
  )
}


// ============================================================
// FEATURE
// ============================================================

function Feature({
  icon,
  title
}: {
  icon: ReactNode
  title: string
}) {

  return (

    <div className="rounded-2xl border border-slate-200 bg-white p-4">

      <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-brand">
        {icon}
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-800">
        {title}
      </p>

    </div>
  )
}


// ============================================================
// INFO CARD
// ============================================================

function InfoCard({
  title,
  text
}: {
  title: string
  text: string
}) {

  return (

    <div className="card p-5">

      <p className="font-semibold text-slate-900">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        {text}
      </p>

    </div>
  )
}


// ============================================================
// UPLOAD PAGE
// ============================================================

function UploadPage({
  onFile,
  onBack
}: {
  onFile: (
    f: File | null
  ) => void

  onBack: () => void
}) {

  const [
    drag,
    setDrag
  ] = useState(false)

  const input =
    useRef<HTMLInputElement>(
      null
    )

  return (

    <div className="mx-auto max-w-5xl">

      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >

        <ArrowLeft
          size={16}
        />

        Back

      </button>


      <div className="mb-8">

        <p className="eyebrow">
          Step 1 · Upload
        </p>

        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Upload a skin image
        </h1>

        <p className="mt-2 text-slate-600">
          Use a clear, close image of the affected area.
        </p>

      </div>


      <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">

        <label
          onDragOver={e => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() =>
            setDrag(false)
          }
          onDrop={e => {

            e.preventDefault()

            setDrag(false)

            onFile(
              e.dataTransfer.files?.[0] ||
              null
            )

          }}
          className={`card flex min-h-[390px] cursor-pointer flex-col items-center justify-center border-2 border-dashed p-8 text-center transition ${
            drag
              ? 'border-brand bg-emerald-50'
              : 'border-slate-300 hover:border-brand hover:bg-slate-50'
          }`}
        >

          <input
            ref={input}
            className="hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={e =>
              onFile(
                e.target.files?.[0] ||
                null
              )
            }
          />

          <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-brand">
            <UploadCloud
              size={30}
            />
          </div>

          <h2 className="text-xl font-semibold text-slate-900">
            Drag & drop your image here
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            or click to browse
          </p>

          <p className="mt-6 text-xs text-slate-400">
            JPG, JPEG, PNG, WebP · Maximum size 10 MB
          </p>

        </label>


        <div className="card p-6">

          <div className="mb-4 flex items-center gap-3">

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-brand">

              <Info
                size={19}
              />

            </div>

            <h3 className="font-semibold">
              Image tips
            </h3>

          </div>


          <ul className="space-y-3 text-sm text-slate-600">

            {[
              'Use good lighting',
              'Keep the lesion clearly visible',
              'Avoid filters',
              'Keep the camera focused',
              'Prefer a close, clear image'
            ].map(
              x => (

                <li
                  key={x}
                  className="flex gap-2"
                >

                  <Check
                    size={16}
                    className="mt-0.5 text-brand"
                  />

                  {x}

                </li>

              )
            )}

          </ul>


          <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">

            <b>Important:</b>{' '}
            Skinova will evaluate image suitability
            before sending it through the screening
            pipeline.

          </div>

        </div>

      </div>

    </div>
  )
}


// ============================================================
// PREVIEW PAGE
// ============================================================

function PreviewPage({
  file,
  preview,
  onReplace,
  onContinue,
  busy
}: {
  file: File | null
  preview: string
  onReplace: () => void
  onContinue: () => void
  busy: boolean
}) {

  return (

    <div className="mx-auto max-w-4xl">

      <div className="mb-8">

        <p className="eyebrow">
          Step 1 · Preview
        </p>

        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Review your image
        </h1>

        <p className="mt-2 text-slate-600">
          Check the uploaded image before sending it for analysis.
        </p>

      </div>


      <div className="card p-5 sm:p-7">

        <div className="overflow-hidden rounded-2xl bg-slate-100">

          <img
            src={preview}
            alt="Uploaded image preview"
            className="mx-auto max-h-[520px] w-full object-contain"
          />

        </div>


        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-brand">

              <FileImage
                size={19}
              />

            </div>

            <div>

              <p className="font-semibold text-slate-800">
                {file?.name}
              </p>

              <p className="text-xs text-slate-500">
                {file
                  ? `${(
                      file.size /
                      1024 /
                      1024
                    ).toFixed(2)} MB`
                  : ''}
              </p>

            </div>

          </div>


          <button
            onClick={onReplace}
            className="btn-secondary"
          >
            Replace image
          </button>

        </div>


        <div className="mt-6 flex justify-end">

          <button
            onClick={
              onContinue
            }
            disabled={busy}
            className="btn-primary"
          >

            {busy ? (
              <>
                <Loader2
                  className="animate-spin"
                  size={17}
                />
                Checking image...
              </>
            ) : (
              <>
                Continue to analysis
                <ArrowRight
                  size={17}
                />
              </>
            )}

          </button>

        </div>

      </div>

    </div>
  )
}


// ============================================================
// ANALYSIS PAGE
// ============================================================

function AnalysisPage({
  text,
  detail
}: {
  text: string
  detail: string
}) {

  return (

    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">

      <div className="w-full text-center">

        <div className="mx-auto mb-7 grid h-24 w-24 place-items-center rounded-full border-8 border-emerald-50 bg-white text-brand shadow-sm">

          <Loader2
            size={38}
            className="animate-spin"
          />

        </div>

        <p className="eyebrow">
          Skinova analysis
        </p>

        <h1 className="mt-3 text-3xl font-semibold text-slate-900">
          {text}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-slate-500">
          {detail}
        </p>

        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">

          <div className="flex items-center gap-3 text-sm">

            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" />

            <span className="font-semibold text-slate-800">
              Working on your assessment
            </span>

          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">

            <div className="h-full w-2/3 animate-pulse rounded-full bg-brand" />

          </div>

        </div>

      </div>

    </div>
  )
}


// ============================================================
// QUESTIONS
// ============================================================

function QuestionsPage({
  questions,
  answers,
  onAnswer,
  onBack,
  onNext,
  busy
}: {
  questions: Question[]
  answers: Record<string, string>
  onAnswer: (
    q: Question,
    v: string
  ) => void
  onBack: () => void
  onNext: () => void
  busy: boolean
}) {

  const [
    idx,
    setIdx
  ] = useState(0)

  const q =
    questions[idx]

  if (!q) {

    return (

      <AnalysisPage
        text="Loading questions"
        detail="Preparing the relevant questions for this assessment."
      />

    )
  }

  const last =
    idx ===
    questions.length - 1

  const selected =
    answers[q.id]

  return (

    <div className="mx-auto max-w-3xl">

      <div className="mb-7">

        <p className="eyebrow">
          Step 2 · Personalized assessment
        </p>

        <div className="mt-3 flex items-end justify-between gap-4">

          <div>

            <h1 className="text-3xl font-semibold">
              A few relevant questions
            </h1>

            <p className="mt-2 text-slate-600">
              Questions are selected dynamically based on your assessment.
            </p>

          </div>

          <span className="text-sm font-semibold text-slate-400">
            {idx + 1}
            {' / '}
            {questions.length}
          </span>

        </div>


        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">

          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{
              width:
                `${
                  (
                    (idx + 1) /
                    questions.length
                  ) *
                  100
                }%`
            }}
          />

        </div>

      </div>


      <div className="card p-6 sm:p-8">

        <h2 className="text-xl font-semibold">
          {q.text}
        </h2>


        <div className="mt-6 grid gap-3">

          {q.options.map(
            option => (

              <button
                key={option}
                onClick={() =>
                  onAnswer(
                    q,
                    option
                  )
                }
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  selected === option
                    ? 'border-brand bg-emerald-50'
                    : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >

                <span className="font-medium">
                  {option}
                </span>

                {selected === option && (

                  <Check
                    size={18}
                    className="text-brand"
                  />

                )}

              </button>

            )
          )}

        </div>


        <div className="mt-8 flex justify-between">

          <button
            onClick={
              idx === 0
                ? onBack
                : () =>
                    setIdx(
                      i => i - 1
                    )
            }
            className="btn-secondary"
          >
            Back
          </button>


          {last ? (

            <button
              onClick={onNext}
              disabled={
                busy ||
                !selected
              }
              className="btn-primary"
            >

              {busy && (

                <Loader2
                  className="animate-spin"
                  size={17}
                />

              )}

              Submit assessment

              <ArrowRight
                size={17}
              />

            </button>

          ) : (

            <button
              onClick={() =>
                setIdx(
                  i => i + 1
                )
              }
              disabled={!selected}
              className="btn-primary"
            >

              Next

              <ArrowRight
                size={17}
              />

            </button>

          )}

        </div>

      </div>

    </div>
  )
}



// ============================================================
// CARE HUB — 7 PRODUCT FEATURES
// ============================================================

function CareHub({
  assessmentId,
  result,
  history
}: {
  assessmentId: string
  result: AssessmentResult
  history: CaseHistoryItem[]
}) {
  const [tab, setTab] = useState<'ai-doctor' | 'chat' | 'care' | 'consult' | 'history'>('ai-doctor')
  const [doctorName, setDoctorName] = useState('Dr. Skinova')
  const [doctorSummary, setDoctorSummary] = useState('')
  const [doctorRecommendation, setDoctorRecommendation] = useState('')
  const [agreement, setAgreement] = useState<AgreementScore | null>(result.agreement || null)
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')

  const [language, setLanguage] = useState<'hi' | 'en'>('en')
  const [chatInput, setChatInput] = useState('')
  const [chat, setChat] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([])
  const [voiceListening, setVoiceListening] = useState(false)

  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [address, setAddress] = useState('')
  const [order, setOrder] = useState<MedicineOrder | null>(null)

  const [homeVisit, setHomeVisit] = useState<HomeConsultation | null>(null)
  const [homeForm, setHomeForm] = useState({ patient_name: '', address: '', date: '', time: '', reason: '' })

  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [messages, setMessages] = useState<ConsultationMessage[]>([])
  const [consultInput, setConsultInput] = useState('')
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [callMode, setCallMode] = useState<'none' | 'voice' | 'video'>('none')
  const [callConnected, setCallConnected] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream])
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      pcRef.current?.close()
      localStream?.getTracks().forEach(t => t.stop())
    }
  }, [localStream])

  const speak = (text: string, lang: 'hi' | 'en') => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }

  const sendChat = async (textOverride?: string) => {
    const message = (textOverride ?? chatInput).trim()
    if (!message || working) return
    setChat(prev => [...prev, { role: 'user', text: message }])
    setChatInput('')
    setWorking(true)
    try {
      const response = await sendAIChat(message, language, assessmentId)
      setChat(prev => [...prev, { role: 'ai', text: response.reply }])
      if (response.reply) speak(response.reply, language)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI chat failed.')
    } finally {
      setWorking(false)
    }
  }

  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStatus('Voice input is not supported in this browser. Use Chrome/Edge for the demo.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setVoiceListening(true)
    recognition.onerror = () => {
      setVoiceListening(false)
      setStatus('Microphone input failed. Please allow microphone access and try again.')
    }
    recognition.onend = () => setVoiceListening(false)
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || ''
      setChatInput(transcript)
      void sendChat(transcript)
    }
    recognition.start()
  }

  const saveDoctor = async () => {
    if (!doctorSummary.trim()) {
      setStatus('Enter a doctor summary first.')
      return
    }
    setWorking(true)
    try {
      await submitDoctorSummary(assessmentId, {
        doctor_name: doctorName,
        specialty: 'Dermatology',
        summary: doctorSummary,
        recommendation: doctorRecommendation
      })
      const score = await getAgreementScore(assessmentId)
      setAgreement(score)
      setStatus('Doctor summary saved and agreement analysis generated.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Doctor review failed.')
    } finally {
      setWorking(false)
    }
  }

  const loadMedicines = async () => {
    try {
      setMedicines(await getMedicines())
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Medicine catalogue unavailable.')
    }
  }

  const placeOrder = async () => {
    const items = (Object.entries(cart) as Array<[string, number]>).filter(([, quantity]) => quantity > 0).map(([medicine_id, quantity]) => ({ medicine_id, quantity }))
    if (!items.length || !address.trim()) {
      setStatus('Select a medicine and enter a delivery address.')
      return
    }
    setWorking(true)
    try {
      const created = await placeMedicineOrder({ items, address, assessment_id: assessmentId })
      setOrder(created)
      setStatus('Order placed in the Skinova prototype order pipeline.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Order failed.')
    } finally {
      setWorking(false)
    }
  }

  const bookHome = async () => {
    if (Object.values(homeForm).some((v: string) => !v.trim())) {
      setStatus('Complete all home consultation fields.')
      return
    }
    setWorking(true)
    try {
      const visit = await bookHomeConsultation({ ...homeForm, assessment_id: assessmentId })
      setHomeVisit(visit)
      setStatus('Home consultation request created.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Home consultation failed.')
    } finally {
      setWorking(false)
    }
  }

  const openConsultation = async () => {
    setWorking(true)
    try {
      const c = await createConsultation({ patient_name: 'Skinova Patient', doctor_name: 'Skinova Dermatology Desk', assessment_id: assessmentId })
      setConsultation(c)
      setMessages([])
      setStatus('Consultation room created. Open the same room in a second browser tab to test two-way chat/video.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create consultation.')
    } finally {
      setWorking(false)
    }
  }

  useEffect(() => {
    if (!consultation) return
    let active = true
    const poll = async () => {
      try {
        const next = await getConsultationMessages(consultation.id)
        if (active) setMessages(next)
      } catch { /* room may still be initializing */ }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 2500)
    return () => { active = false; window.clearInterval(timer) }
  }, [consultation])

  const sendDoctorChat = async () => {
    if (!consultation || !consultInput.trim()) return
    try {
      await sendConsultationMessage(consultation.id, { sender: 'patient', text: consultInput.trim(), language })
      setConsultInput('')
      setMessages(await getConsultationMessages(consultation.id))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Message failed.')
    }
  }

  const startCall = async (mode: 'voice' | 'video') => {
    if (!consultation) {
      setStatus('Create a doctor consultation room first.')
      return
    }
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setStatus('Camera/microphone access requires HTTPS in production.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' })
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      const remote = new MediaStream()
      stream.getTracks().forEach(track => pc.addTrack(track, stream))
      pc.ontrack = event => {
        event.streams[0]?.getTracks().forEach(track => remote.addTrack(track))
        setRemoteStream(remote)
      }
      pc.onicecandidate = event => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }))
        }
      }
      const ws = new WebSocket(consultationWebSocketUrl(consultation.id))
      ws.onmessage = async event => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(message.offer))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            ws.send(JSON.stringify({ type: 'answer', answer }))
          } else if (message.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(message.answer))
          } else if (message.type === 'candidate' && message.candidate) {
            try { await pc.addIceCandidate(message.candidate) } catch { /* stale ICE */ }
          }
        } catch { /* ignore malformed signaling messages */ }
      }
      ws.onopen = async () => {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ws.send(JSON.stringify({ type: 'offer', offer }))
      }
      ws.onerror = () => setStatus('Realtime signaling failed. Check the backend and WebSocket connection.')
      wsRef.current = ws
      pcRef.current = pc
      setLocalStream(stream)
      setCallMode(mode)
      setCallConnected(true)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not access microphone/camera.')
    }
  }

  const endCall = () => {
    wsRef.current?.close()
    wsRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    localStream?.getTracks().forEach(t => t.stop())
    setLocalStream(null)
    setRemoteStream(null)
    setCallMode('none')
    setCallConnected(false)
  }

  const tabs = [
    ['ai-doctor', 'AI ↔ Doctor', Bot],
    ['chat', 'Multilingual AI', Languages],
    ['care', 'Medicines + Home', ShoppingCart],
    ['consult', 'Doctor Room', Video],
    ['history', 'Skin Timeline', CalendarDays]
  ] as const

  return (
    <section className="card mt-5 p-6 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">Skinova Care Hub</p>
          <h2 className="mt-2 text-2xl font-semibold">From screening to continuous care</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">These modules are connected to the same assessment so the user can move from AI screening to clinician review, communication, care access and longitudinal tracking.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${tab === id ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Icon size={18} />
            <span className="mt-2 block">{label}</span>
          </button>
        ))}
      </div>

      {status && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{status}</div>}

      {tab === 'ai-doctor' && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2 font-semibold"><Bot size={19} className="text-brand" /> AI Summary</div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{result.aiSummary || result.explanation}</p>
            <div className="mt-4 rounded-xl bg-white p-4 text-xs text-slate-500">AI confidence: {result.confidence.toFixed(1)}% — this is a model output score, not a disease probability.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 font-semibold"><UserRound size={19} className="text-brand" /> Doctor Summary</div>
            <input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Doctor name" className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <textarea value={doctorSummary} onChange={e => setDoctorSummary(e.target.value)} placeholder="Enter clinician observations / summary" rows={4} className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <textarea value={doctorRecommendation} onChange={e => setDoctorRecommendation(e.target.value)} placeholder="Doctor's recommended next step" rows={3} className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <button onClick={() => void saveDoctor()} disabled={working} className="btn-primary mt-3"><ClipboardCheck size={17} /> Save & compare</button>
          </div>
          {agreement && (
            <div className="lg:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">AI–Doctor Agreement</p><h3 className="mt-1 text-3xl font-semibold text-emerald-950">{agreement.score}%</h3></div><span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-emerald-800">{agreement.label}</span></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">{Object.entries(agreement.dimensions).map(([key, value]) => <div key={key} className="rounded-xl bg-white p-3"><p className="text-xs capitalize text-slate-500">{key}</p><p className="mt-1 font-bold">{value}%</p></div>)}</div>
              <p className="mt-4 text-sm leading-6 text-emerald-900">{agreement.explanation}</p>
              <p className="mt-2 text-xs text-emerald-700">This measures semantic agreement only; it does not declare AI or doctor correctness.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Gemini Multilingual Assistant</h3><p className="text-xs text-slate-500">Text + voice input/output</p></div><div className="flex rounded-xl border border-slate-200 p-1"><button onClick={() => setLanguage('en')} className={`px-3 py-1.5 text-xs font-bold ${language === 'en' ? 'rounded-lg bg-slate-900 text-white' : ''}`}>English</button><button onClick={() => setLanguage('hi')} className={`px-3 py-1.5 text-xs font-bold ${language === 'hi' ? 'rounded-lg bg-slate-900 text-white' : ''}`}>हिन्दी</button></div></div>
            <div className="mt-4 min-h-[220px] space-y-3 rounded-xl bg-slate-50 p-4">{chat.length === 0 ? <p className="text-sm text-slate-500">Ask about your screening result, next steps or how to prepare for a doctor consultation.</p> : chat.map((item, i) => <div key={i} className={`max-w-[90%] rounded-xl p-3 text-sm ${item.role === 'user' ? 'ml-auto bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}>{item.text}</div>)}</div>
            <div className="mt-3 flex gap-2"><input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void sendChat() }} placeholder={language === 'hi' ? 'अपना सवाल लिखें...' : 'Ask Skinova...'} className="min-w-0 flex-1 rounded-xl border border-slate-200 p-3 text-sm" /><button onClick={startVoice} className={`btn-secondary ${voiceListening ? 'border-red-300 bg-red-50' : ''}`} title="Voice input"><Mic size={17} /></button><button onClick={() => void sendChat()} disabled={working} className="btn-primary">Send</button></div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><h3 className="font-semibold text-blue-950">Voice workflow</h3><div className="mt-4 space-y-3 text-sm leading-6 text-blue-900"><p>🎙 Speak in Hindi or English.</p><p>🧠 Gemini processes the conversation.</p><p>🔊 Skinova speaks the response back in the selected language.</p><p>📋 The same conversation can be summarized for clinician review.</p></div><button onClick={() => speak(language === 'hi' ? 'नमस्ते, मैं स्किनोवा हूँ। आप अपना सवाल पूछ सकते हैं।' : 'Hello, I am Skinova. You can ask your question.', language)} className="btn-secondary mt-5"><Mic size={16} /> Test voice output</button></div>
        </div>
      )}

      {tab === 'care' && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between"><div><h3 className="font-semibold">Medicine integration</h3><p className="text-xs text-slate-500">Prototype catalogue with prescription guardrail</p></div><button onClick={() => void loadMedicines()} className="btn-secondary">Load medicines</button></div>
            <div className="mt-4 space-y-2">{medicines.map(m => <div key={m.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{m.name}</p><p className="text-xs text-slate-500">{m.strength} · ₹{m.price}</p></div><button onClick={() => setCart(c => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }))} disabled={m.availability !== 'in_stock'} className="btn-secondary"><ShoppingCart size={15} /> Add</button></div>{m.note && <p className="mt-2 text-xs text-slate-500">{m.note}</p>}</div>)}</div>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <button onClick={() => void placeOrder()} disabled={working} className="btn-primary mt-3"><PackageCheck size={17} /> Place order</button>
            {order && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Order <b>{order.id}</b> · {order.status} · ₹{order.total.toFixed(2)}</div>}
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 font-semibold"><HomeIcon size={19} className="text-brand" /> Doctor consultation at home</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><input placeholder="Patient name" value={homeForm.patient_name} onChange={e => setHomeForm(f => ({ ...f, patient_name: e.target.value }))} className="rounded-xl border border-slate-200 p-3 text-sm" /><input type="date" value={homeForm.date} onChange={e => setHomeForm(f => ({ ...f, date: e.target.value }))} className="rounded-xl border border-slate-200 p-3 text-sm" /><input type="time" value={homeForm.time} onChange={e => setHomeForm(f => ({ ...f, time: e.target.value }))} className="rounded-xl border border-slate-200 p-3 text-sm" /><input placeholder="Address" value={homeForm.address} onChange={e => setHomeForm(f => ({ ...f, address: e.target.value }))} className="rounded-xl border border-slate-200 p-3 text-sm" /></div><textarea placeholder="Reason for visit" value={homeForm.reason} onChange={e => setHomeForm(f => ({ ...f, reason: e.target.value }))} rows={4} className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button onClick={() => void bookHome()} disabled={working} className="btn-primary mt-3"><HomeIcon size={17} /> Request home visit</button>{homeVisit && <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Request <b>{homeVisit.id}</b> · {homeVisit.status}</div>}
          </div>
        </div>
      )}

      {tab === 'consult' && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold">Doctor chatroom</h3>
            {!consultation ? <button onClick={() => void openConsultation()} disabled={working} className="btn-primary mt-4"><MessageCircle size={17} /> Create consultation room</button> : <><p className="mt-3 text-sm text-slate-500">Room: {consultation.id}</p><div className="mt-4 max-h-72 space-y-2 overflow-auto rounded-xl bg-slate-50 p-3">{messages.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : messages.map(m => <div key={m.id} className={`rounded-xl p-3 text-sm ${m.sender === 'patient' ? 'ml-8 bg-emerald-50' : 'mr-8 bg-white'}`}><b>{m.sender}</b><p className="mt-1">{m.text}</p></div>)}</div><div className="mt-3 flex gap-2"><input value={consultInput} onChange={e => setConsultInput(e.target.value)} placeholder="Message doctor..." className="min-w-0 flex-1 rounded-xl border border-slate-200 p-3 text-sm" /><button onClick={() => void sendDoctorChat()} className="btn-primary">Send</button></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void startCall('voice')} className="btn-secondary"><Phone size={16} /> Voice</button><button onClick={() => void startCall('video')} className="btn-secondary"><Video size={16} /> Video</button>{callConnected && <button onClick={endCall} className="btn-secondary border-red-200 text-red-700"><MicOff size={16} /> End</button>}</div></>}
          </div>
          <div className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Live consultation</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${callConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{callConnected ? `${callMode} connected` : 'Not connected'}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="overflow-hidden rounded-xl bg-slate-900 aspect-video"><video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" /></div><div className="overflow-hidden rounded-xl bg-slate-900 aspect-video"><video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" /></div></div><p className="mt-3 text-xs leading-5 text-slate-500">WebRTC handles media directly between browsers; the FastAPI WebSocket is used only for signaling. For the prototype, open the same consultation room in a second tab/device to exercise the two-party flow.</p></div>
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-6 rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Longitudinal skin monitoring</h3><p className="text-sm text-slate-500">Compare assessments over time and bring changes to a clinician.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{history.length} records</span></div><div className="mt-5 space-y-3">{history.length === 0 ? <p className="text-sm text-slate-500">No previous assessments stored in this browser.</p> : history.map((item, index) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{new Date(item.date).toLocaleString()}</p><p className="mt-1 font-semibold">{item.prediction}</p><p className="text-xs text-slate-500">Model output: {item.confidence.toFixed(1)}%</p></div><div className="flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.priority}</span>{index === 0 && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Current</span>}</div></div>)}</div><div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><b>Comparison workflow:</b> future uploads can be linked to the same patient timeline so Skinova can compare visible image characteristics across visits. This is visual change detection, not a diagnosis of disease progression.</div></div>
      )}
    </section>
  )
}

// ============================================================
// RESULT PAGE
// ============================================================

function ResultPage({
  result,
  places,
  report,
  imageQuality,
  assessmentId,
  history,
  onStartOver
}: {
  result: AssessmentResult
  places: Place[]
  report: string
  imageQuality:
    ImageQuality | null
  assessmentId: string
  history: CaseHistoryItem[]
  onStartOver: () => void
}) {

  const demo =
    result.demo === true

  return (

    <div className="mx-auto max-w-6xl">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="mb-8 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <p className="eyebrow">
              Step 4 · Results
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Your Screening Summary
            </h1>

            <p className="mt-2 max-w-2xl text-slate-600">

              {demo
                ? 'Frontend demo preview — connect the FastAPI backend to show the real ML and AI result.'
                : 'Gemini-assisted screening support based on the information provided.'}

            </p>

          </div>


          <a
            href={
              demo
                ? '#backend-required'
                : report
            }
            onClick={e => {

              if (demo) {

                e.preventDefault()

                document
                  .getElementById(
                    'backend-required'
                  )
                  ?.scrollIntoView({
                    behavior:
                      'smooth'
                  })
              }

            }}
            target={
              demo
                ? '_self'
                : '_blank'
            }
            rel="noreferrer"
            className={`download-box ${
              demo
                ? 'download-box-disabled'
                : ''
            }`}
          >

            <FileDown
              size={23}
            />

            <span>

              <b>
                {demo
                  ? 'PDF ready after backend connection'
                  : 'Download Screening Summary'}
              </b>

              <small>
                {demo
                  ? 'Connect FastAPI to generate the real PDF'
                  : 'Open the backend-generated PDF'}
              </small>

            </span>

          </a>

        </div>

      </div>


      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">


        {/* ==================================================
            LEFT COLUMN
        ================================================== */}

        <section className="card p-6 sm:p-8">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <h2 className="text-xl font-semibold">
              Image analysis
            </h2>

            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-brand">
              {demo
                ? 'Demo preview'
                : 'Screening support'}
            </span>

          </div>


          {demo ? (

            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">

              <b>
                Real model result is intentionally
                not shown in demo mode.
              </b>

              {' '}

              The earlier frontend should never label
              a signature, document or arbitrary photo
              as a skin disease. Once the backend is
              connected, this card will display the ML
              model's actual prediction and confidence.

            </div>

          ) : (

            <>

              {/* ==================================================
                  MODEL METRICS
              ================================================== */}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">

                <Metric
                  label="Model prediction"
                  value={
                    result.prediction
                  }
                />

                <Metric
                  label="Model confidence"
                  value={`${result.confidence.toFixed(
                    1
                  )}%`}
                />

              </div>


              {/* ==================================================
                  ASSESSMENT QUALITY
              ================================================== */}

              {(
                imageQuality ||
                result.imageQuality
              ) && (

                <ImageQualityCard
                  quality={
                    imageQuality ||
                    result.imageQuality!
                  }
                />

              )}


              {/* ==================================================
                  SAFETY ESCALATION
              ================================================== */}

              {result.safetyEscalation && (

                <SafetyEscalationCard
                  escalation={
                    result.safetyEscalation
                  }
                />

              )}


              {/* ==================================================
                  UNCERTAINTY
              ================================================== */}

              {result.uncertainty?.status ===
                'uncertain' && (

                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">

                  <div className="flex items-center gap-2 font-semibold text-amber-900">

                    <AlertTriangle
                      size={18}
                    />

                    Low-confidence / ambiguous visual result

                  </div>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    {result.uncertainty.reason}
                  </p>

                  <p className="mt-3 text-xs leading-5 text-amber-700">
                    Skinova will use the available
                    context to provide screening guidance,
                    but this result should not be treated
                    as a diagnosis.
                  </p>

                </div>

              )}


              {/* ==================================================
                  GRAD-CAM
              ================================================== */}

              {result.gradcamUrl && (

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">

                  <div className="flex items-center justify-between">

                    <h3 className="font-semibold">
                      Model visual explanation
                    </h3>

                    <span className="text-xs text-slate-400">
                      Grad-CAM
                    </span>

                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">

                    <img
                      src={
                        result.gradcamUrl
                      }
                      alt="Grad-CAM model attention overlay"
                      className="mx-auto w-full max-w-xl object-contain"
                    />

                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Highlighted regions show areas that
                    contributed to the classifier's prediction.
                    This is model attribution, not a clinical
                    explanation.
                  </p>

                </div>

              )}


              {/* ==================================================
                  DISTRIBUTION
              ================================================== */}

              {result.distribution.length >
                0 && (

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">

                  <div className="flex items-center justify-between">

                    <h3 className="font-semibold">
                      7-class model prediction distribution
                    </h3>

                    <span className="text-xs text-slate-400">
                      Model output
                    </span>

                  </div>


                  <div className="mt-4 space-y-3">

                    {result.distribution.map(
                      item => (

                        <div
                          key={item.code}
                        >

                          <div className="mb-1 flex items-center justify-between text-sm">

                            <span className="font-medium text-slate-700">
                              {item.code}
                              {' · '}
                              {item.name}
                            </span>

                            <span className="font-semibold text-slate-500">
                              {item.score.toFixed(
                                1
                              )}
                              %
                            </span>

                          </div>


                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                            <div
                              className={`h-full rounded-full ${
                                item.code ===
                                result.distribution[0].code
                                  ? 'bg-brand'
                                  : 'bg-slate-300'
                              }`}
                              style={{
                                width:
                                  `${
                                    Math.max(
                                      0,
                                      Math.min(
                                        item.score,
                                        100
                                      )
                                    )
                                  }%`
                              }}
                            />

                          </div>

                        </div>

                      )
                    )}

                  </div>


                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    These are the classifier's output scores,
                    not medically calibrated disease probabilities.
                  </p>

                </div>

              )}


              {/* ==================================================
                  EXPLANATION
              ================================================== */}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                {result.explanation}
              </div>


              {/* ==================================================
                  DISCLAIMER
              ================================================== */}

              {result.disclaimer && (

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                  {result.disclaimer}
                </div>

              )}


              {/* ==================================================
                  PRIORITY
              ================================================== */}

              {result.priority && (

                <div className="mt-5 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4">

                  <span className="font-semibold text-amber-900">
                    Priority for professional evaluation
                  </span>

                  <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-amber-800">
                    {result.priority}
                  </span>

                </div>

              )}

            </>

          )}


          {/* ==================================================
              FACTORS
          ================================================== */}

          <div className="mt-8">

            <h3 className="font-semibold">
              Key factors considered
            </h3>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">

              {result.factors.map(
                factor => (

                  <li
                    key={factor}
                    className="flex gap-2 text-sm text-slate-600"
                  >

                    <Check
                      size={17}
                      className="mt-0.5 shrink-0 text-brand"
                    />

                    {factor}

                  </li>

                )
              )}

            </ul>

          </div>

        </section>


        {/* ==================================================
            RIGHT COLUMN
        ================================================== */}

        <section className="card p-6 sm:p-8">

          <h2 className="text-xl font-semibold">
            Recommended next steps
          </h2>


          <ul className="mt-5 space-y-4">

            {result.recommendations.map(
              recommendation => (

                <li
                  key={recommendation}
                  className="flex gap-3 text-sm leading-6 text-slate-600"
                >

                  <ShieldCheck
                    size={18}
                    className="mt-1 shrink-0 text-brand"
                  />

                  {recommendation}

                </li>

              )
            )}

          </ul>


          <div className="mt-8 border-t border-slate-200 pt-6">

            <h3 className="font-semibold">
              Relevant medical information
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">

              {demo
                ? 'This section will be populated from the RAG service when the backend is connected.'
                : 'Evidence-backed information retrieved by the system.'}

            </p>


            {result.sources &&
              result.sources.length >
                0 && (

                <ul className="mt-4 space-y-2">

                  {result.sources.map(
                    source => (

                      <li
                        key={
                          source.title
                        }
                      >

                        <a
                          className="inline-flex items-center gap-1 text-sm font-semibold text-brand underline"
                          href={
                            source.url
                          }
                          target="_blank"
                          rel="noreferrer"
                        >

                          {source.title}

                          <ExternalLink
                            size={13}
                          />

                        </a>

                      </li>

                    )
                  )}

                </ul>

              )}

          </div>

        </section>

      </div>


      {/* ======================================================
          NEARBY CARE
      ====================================================== */}

      <section className="card mt-5 p-6 sm:p-8">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <p className="eyebrow">
              Find professional care
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Nearby dermatology care
            </h2>

          </div>


          <a
            href="https://www.google.com/maps/search/dermatologist"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >

            <MapPin
              size={17}
            />

            Search on Google Maps

          </a>

        </div>


        <div className="mt-6 grid gap-3 md:grid-cols-2">

          {places.length ? (

            places.map(
              place => (

                <div
                  key={
                    place.name
                  }
                  className="rounded-2xl border border-slate-200 p-4"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div>

                      <h3 className="font-semibold">
                        {place.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">

                        {place.address}

                        {place.distance
                          ? ` · ${place.distance}`
                          : ''}

                      </p>

                    </div>

                    {place.rating && (

                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        ★ {place.rating}
                      </span>

                    )}

                  </div>


                  <a
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand"
                    href={
                      place.url ||
                      'https://www.google.com/maps/search/dermatologist'
                    }
                    target="_blank"
                    rel="noreferrer"
                  >

                    Directions

                    <ArrowRight
                      size={15}
                    />

                  </a>

                </div>

              )
            )

          ) : (

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900 md:col-span-2">

              Nearby places will appear here when
              location is available and the backend
              healthcare endpoint returns results.

              {' '}

              You can use the Google Maps search
              button meanwhile.

            </div>

          )}

        </div>

      </section>


      <CareHub
        assessmentId={assessmentId}
        result={result}
        history={history}
      />

      <div
        id="backend-required"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600"
      >

        <b className="text-slate-900">
          Screening disclaimer:
        </b>

        {' '}

        This tool is for screening and informational
        purposes only. It does not provide a medical
        diagnosis or replace evaluation by a qualified
        healthcare professional.

      </div>


      <div className="mt-6 flex justify-center">

        <button
          onClick={onStartOver}
          className="btn-secondary"
        >

          <RefreshCw
            size={16}
          />

          Start a new assessment

        </button>

      </div>

    </div>
  )
}


// ============================================================
// IMAGE QUALITY CARD
// ============================================================

function ImageQualityCard({
  quality
}: {
  quality: ImageQuality
}) {

  const sharpness =
    quality.sharpness_score ??
    Math.round(
      Math.min(
        100,
        quality.blur_score /
          1.8
      )
    )

  return (

    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">

      <div className="flex items-center justify-between gap-3">

        <div>

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Assessment Quality
          </p>

          <h3 className="mt-1 text-2xl font-semibold text-slate-900">
            {quality.quality_score}
            /100
          </h3>

        </div>


        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            quality.quality ===
            'good'
              ? 'bg-emerald-50 text-brand'
              : 'bg-amber-50 text-amber-700'
          }`}
        >

          {quality.quality ===
          'good'
            ? 'Good for analysis'
            : 'Needs improvement'}

        </span>

      </div>


      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">

        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{
            width:
              `${quality.quality_score}%`
          }}
        />

      </div>


      <div className="mt-4 grid gap-3 sm:grid-cols-3">

        <Metric
          label="Sharpness"
          value={`${sharpness}/100`}
        />

        <Metric
          label="Brightness"
          value={String(
            Math.round(
              quality.brightness
            )
          )}
        />

        <Metric
          label="Resolution"
          value={`${
            quality.resolution.width
          }×${
            quality.resolution.height
          }`}
        />

      </div>


      {quality.issues.length >
        0 && (

        <ul className="mt-4 space-y-2 text-sm text-amber-800">

          {quality.issues.map(
            issue => (

              <li
                key={issue}
                className="flex gap-2"
              >

                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0"
                />

                {issue}

              </li>

            )
          )}

        </ul>

      )}


      <p className="mt-4 text-xs leading-5 text-slate-500">

        This score evaluates image suitability
        for the screening pipeline. It is not
        a measure of medical accuracy or diagnostic
        certainty.

      </p>

    </div>
  )
}


// ============================================================
// SAFETY ESCALATION CARD
// ============================================================

function SafetyEscalationCard({
  escalation
}: {
  escalation: NonNullable<
    AssessmentResult[
      'safetyEscalation'
    ]
  >
}) {

  const isHigh =
    escalation.level ===
    'high'

  const isModerate =
    escalation.level ===
    'moderate'

  const isUncertain =
    escalation.level ===
    'uncertain'


  const containerClass =
    isHigh
      ? 'border-red-200 bg-red-50'
      : isModerate
      ? 'border-amber-200 bg-amber-50'
      : isUncertain
      ? 'border-blue-200 bg-blue-50'
      : 'border-emerald-200 bg-emerald-50'


  const iconClass =
    isHigh
      ? 'text-red-600'
      : isModerate
      ? 'text-amber-600'
      : isUncertain
      ? 'text-blue-600'
      : 'text-emerald-600'


  return (

    <div
      className={`mt-5 rounded-2xl border p-5 ${containerClass}`}
    >

      <div className="flex items-start gap-3">

        <AlertTriangle
          size={20}
          className={`mt-0.5 ${iconClass}`}
        />


        <div className="flex-1">

          <p className="text-xs font-bold uppercase tracking-wider opacity-70">
            Safety escalation
          </p>

          <h3 className="mt-1 text-lg font-semibold">
            {escalation.status}
          </h3>

          <p className="mt-2 text-sm leading-6">
            {escalation.message}
          </p>


          {escalation.signal_details &&
            escalation.signal_details.length >
              0 && (

              <div className="mt-4">

                <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                  Reported signals
                </p>

                <ul className="mt-2 space-y-1 text-sm">

                  {escalation.signal_details.map(
                    signal => (

                      <li
                        key={signal}
                        className="flex gap-2"
                      >

                        <Check
                          size={15}
                          className="mt-0.5 shrink-0"
                        />

                        {signal}

                      </li>

                    )
                  )}

                </ul>

              </div>

            )}


          <p className="mt-4 text-xs leading-5 opacity-70">

            This is a screening workflow safeguard,
            not a clinically validated medical risk score.

          </p>

        </div>

      </div>

    </div>
  )
}


// ============================================================
// METRIC
// ============================================================

function Metric({
  label,
  value
}: {
  label: string
  value: string
}) {

  return (

    <div className="rounded-2xl border border-slate-200 bg-white p-5">

      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>

    </div>
  )
}


// ============================================================
// FOOTER
// ============================================================

function Footer() {

  return (

    <footer className="mt-12 border-t border-slate-200 bg-white">

      <div className="container-app flex flex-col gap-3 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">

        <Logo />

        <span>
          Screening support · Informational use only
        </span>

      </div>

    </footer>
  )
}