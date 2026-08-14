import { useEffect, useMemo, useRef, useState } from 'react'
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
  UploadCloud,
  X,
  Code2,
  ExternalLink
} from 'lucide-react'

import {
  checkImageQuality,
  getHospitals,
  getQuestions,
  getResult,
  reportUrl,
  startAssessment,
  submitAnswers,
  uploadImage,
  type AssessmentResult,
  type Question
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

type ImageQuality = {
  quality: 'good' | 'needs_improvement'
  blur_score?: number
  brightness?: number
  width?: number
  height?: number
  issues: string[]
}


const steps = [
  'Upload',
  'Questions',
  'Analysis',
  'Results'
]

const demoHeroImage =
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/Nevus.jpg'


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


export default function App() {
  const [step, setStep] =
    useState<Step>('home')

  const [assessmentId, setAssessmentId] =
    useState('')

  const [file, setFile] =
    useState<File | null>(null)

  const [preview, setPreview] =
    useState('')

  const [error, setError] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  const [checkingQuality, setCheckingQuality] =
    useState(false)

  const [imageQuality, setImageQuality] =
    useState<ImageQuality | null>(null)

  const [questions, setQuestions] =
    useState<Question[]>([])

  const [answers, setAnswers] =
    useState<Record<string, string>>({})

  const [result, setResult] =
    useState<AssessmentResult | null>(null)

  const [places, setPlaces] =
    useState<Place[]>([])


  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])


  const currentIndex = useMemo(
    () =>
      step === 'home'
        ? -1
        : step === 'upload' || step === 'preview'
          ? 0
          : step === 'questions'
            ? 1
            : step === 'analysis' || step === 'processing'
              ? 2
              : 3,
    [step]
  )


  const start = async () => {
    setError('')
    setBusy(true)

    setFile(null)
    setPreview('')
    setImageQuality(null)
    setCheckingQuality(false)

    setQuestions([])
    setAnswers({})
    setResult(null)
    setPlaces([])

    try {
      const response =
        await startAssessment()

      setAssessmentId(response.id)
      setStep('upload')
    } catch (error) {
      console.error(error)

      setError(
        error instanceof Error
          ? error.message
          : 'Unable to start the assessment. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }


  const chooseFile = async (
    selectedFile: File | null
  ) => {
    setError('')

    if (!selectedFile) {
      return
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ]

    if (!allowedTypes.includes(selectedFile.type)) {
      setError(
        'Please upload a supported image format: JPG, PNG or WebP.'
      )
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError(
        'Please upload an image smaller than 10 MB.'
      )
      return
    }

    if (!assessmentId) {
      setError(
        'Assessment session is missing. Please start a new assessment.'
      )
      return
    }

    if (preview) {
      URL.revokeObjectURL(preview)
    }

    const objectUrl =
      URL.createObjectURL(selectedFile)

    setFile(selectedFile)
    setPreview(objectUrl)

    setQuestions([])
    setAnswers({})
    setResult(null)
    setImageQuality(null)

    /*
     * P1 — Capture Quality Assistant.
     *
     * This is a usability/CV heuristic, not a medical validation.
     *
     * A quality-service failure should NOT prevent the user
     * from continuing with the assessment.
     */
    setCheckingQuality(true)

    try {
      const quality =
        await checkImageQuality(
          assessmentId,
          selectedFile
        )

      setImageQuality(quality)

      if (
        quality.quality === 'needs_improvement'
      ) {
        setError(
          'The image may be difficult to analyze reliably. Review the quality guidance before continuing.'
        )
      }
    } catch (qualityError) {
      console.error(
        'Image quality check failed:',
        qualityError
      )

      setImageQuality({
        quality: 'needs_improvement',
        issues: [
          'Image quality could not be verified automatically. Use a clear, well-lit image.'
        ]
      })

      /*
       * Do not block the assessment just because
       * the quality helper failed.
       */
    } finally {
      setCheckingQuality(false)
      setStep('preview')
    }
  }


  const handleUpload = async () => {
    if (!file || !assessmentId) {
      setError(
        'Assessment session is missing. Please start a new assessment.'
      )
      return
    }

    setBusy(true)
    setError('')
    setStep('analysis')

    try {
      await uploadImage(
        assessmentId,
        file
      )

      const qs =
        await getQuestions(
          assessmentId
        )

      if (!qs.length) {
        throw new Error(
          'The AI service returned no assessment questions.'
        )
      }

      setQuestions(qs)
      setAnswers({})
      setStep('questions')
    } catch (error) {
      console.error(error)

      setError(
        error instanceof Error
          ? error.message
          : 'Unable to upload or analyze the image. Please try again.'
      )

      setStep('preview')
    } finally {
      setBusy(false)
    }
  }


  const answerQuestion = (
    q: Question,
    value: string
  ) => {
    setAnswers(previous => ({
      ...previous,
      [q.id]: value
    }))
  }


  const finishQuestions = async () => {
    const missing =
      questions.some(
        q =>
          q.required &&
          !answers[q.id]?.trim()
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

      setStep('processing')

      const finalResult =
        await getResult(
          assessmentId
        )

      setResult(finalResult)

      /*
       * Nearby care is intentionally non-blocking.
       * If location is denied or the healthcare API fails,
       * the main medical/screening result still renders.
       */
      try {
        const nearbyPlaces =
          await getHospitals()

        setPlaces(
          nearbyPlaces
        )
      } catch {
        setPlaces([])
      }

      setStep('result')
    } catch (error) {
      console.error(error)

      setError(
        error instanceof Error
          ? error.message
          : 'Assessment could not be completed. Please try again.'
      )

      setStep('questions')
    } finally {
      setBusy(false)
    }
  }


  const reset = () => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }

    setStep('home')
    setFile(null)
    setPreview('')
    setError('')
    setBusy(false)

    setCheckingQuality(false)
    setImageQuality(null)

    setResult(null)
    setQuestions([])
    setAnswers({})
    setPlaces([])
    setAssessmentId('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }


  return (
    <div className="min-h-screen bg-soft text-ink">

      <Header
        step={step}
        onHome={reset}
      />

      {step !== 'home' && (
        <Progress
          current={currentIndex}
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
            quality={imageQuality}
            checkingQuality={checkingQuality}
            onReplace={() =>
              setStep('upload')
            }
            onContinue={handleUpload}
            busy={busy}
          />
        )}


        {step === 'analysis' && (
          <AnalysisPage
            text="Analyzing your image"
            detail="The screening model is processing the uploaded image."
          />
        )}


        {step === 'questions' && (
          <QuestionsPage
            questions={questions}
            answers={answers}
            onAnswer={answerQuestion}
            onBack={() =>
              setStep('preview')
            }
            onNext={finishQuestions}
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
              report={reportUrl(
                assessmentId
              )}
              onStartOver={reset}
            />
          )}

      </main>

      <Footer />

    </div>
  )
}


/* ============================================================
   HEADER
============================================================ */

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
              <RefreshCw size={15} />
              New
            </button>
          )}

          {step === 'home' && (
            <button
              onClick={() =>
                document
                  .getElementById('about')
                  ?.scrollIntoView({
                    behavior: 'smooth'
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


/* ============================================================
   PROGRESS
============================================================ */

function Progress({
  current
}: {
  current: number
}) {
  return (
    <div className="border-b border-slate-200 bg-white">

      <div className="container-app flex items-center gap-2 py-3">

        {steps.map(
          (stepName, index) => (
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
                  <Check size={14} />
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


/* ============================================================
   HOME
============================================================ */

function Home({
  onStart,
  busy
}: {
  onStart: () => void
  busy: boolean
}) {
  return (
    <div>

      <section className="grid items-center gap-12 py-8 lg:grid-cols-[1.03fr_.97fr] lg:py-14">

        <div>

          <div className="eyebrow mb-5 flex items-center gap-2">
            <Sparkles size={14} />
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
              {busy && (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              )}

              Start Assessment

              <ArrowRight size={17} />
            </button>

          </div>

          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">

            <Feature
              icon={<ShieldCheck size={17} />}
              title="Screening support"
            />

            <Feature
              icon={<HeartPulse size={17} />}
              title="Personalized context"
            />

            <Feature
              icon={<Hospital size={17} />}
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
                    Uploaded user images are analyzed only
                    after the assessment begins.
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
              A focused screening assistant, not a diagnosis tool.
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
                'JPG, PNG and WebP images up to 10 MB are supported in the upload flow.'
              ],
              [
                'What does model confidence mean?',
                'It is the model’s confidence in its predicted class. It is not diagnostic accuracy and it is not a cancer-risk percentage.'
              ],
              [
                'Can I use a random photo or signature?',
                'The frontend and backend validate image format and readability, but the quality assistant is only a usability heuristic. Skinova does not claim a diagnosis from arbitrary images.'
              ],
              [
                'Where do nearby clinics come from?',
                'Nearby healthcare results come from the configured backend healthcare search endpoint. The language model does not invent clinic names.'
              ],
              [
                'Can I download the summary?',
                'Yes. The Download Screening Summary button opens the backend-generated PDF after a completed assessment.'
              ]
            ].map(
              ([question, answer]) => (
                <details
                  key={question}
                  className="card group p-5"
                >

                  <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-slate-900">

                    <CircleHelp
                      size={18}
                      className="text-brand"
                    />

                    {question}

                    <span className="ml-auto text-slate-400 transition group-open:rotate-45">
                      +
                    </span>

                  </summary>

                  <p className="mt-3 pl-7 text-sm leading-6 text-slate-600">
                    {answer}
                  </p>

                </details>
              )
            )}

          </div>

        </div>

      </section>


      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">

        <b>
          Important:
        </b>{' '}
        This tool is for screening and informational purposes only.
        It does not provide a medical diagnosis or replace evaluation
        by a qualified healthcare professional.

      </div>


      <p className="mt-3 text-xs text-slate-400">

        Hero reference image: Wikimedia Commons,
        public-domain nevus image.{' '}

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


function Feature({
  icon,
  title
}: {
  icon: React.ReactNode
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


/* ============================================================
   UPLOAD
============================================================ */

function UploadPage({
  onFile,
  onBack
}: {
  onFile: (
    file: File | null
  ) => void

  onBack: () => void
}) {

  const [drag, setDrag] =
    useState(false)

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
        <ArrowLeft size={16} />
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
          onDragOver={event => {
            event.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() =>
            setDrag(false)
          }
          onDrop={event => {
            event.preventDefault()
            setDrag(false)

            onFile(
              event.dataTransfer.files?.[0] ||
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
            onChange={event =>
              onFile(
                event.target.files?.[0] ||
                  null
              )
            }
          />

          <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-brand">
            <UploadCloud size={30} />
          </div>

          <h2 className="text-xl font-semibold text-slate-900">
            Drag & drop your image here
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            or click to browse
          </p>

          <p className="mt-6 text-xs text-slate-400">
            JPG, PNG, WebP · Maximum size 10 MB
          </p>

        </label>


        <div className="card p-6">

          <div className="mb-4 flex items-center gap-3">

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-brand">
              <Info size={19} />
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
              tip => (
                <li
                  key={tip}
                  className="flex gap-2"
                >
                  <Check
                    size={16}
                    className="mt-0.5 text-brand"
                  />
                  {tip}
                </li>
              )
            )}

          </ul>


          <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">

            <b>
              Image quality check:
            </b>{' '}
            Skinova checks basic image properties
            such as blur, brightness and resolution
            before analysis. These checks are usability
            heuristics, not medical validation.

          </div>

        </div>

      </div>

    </div>
  )
}


/* ============================================================
   PREVIEW + QUALITY
============================================================ */

function PreviewPage({
  file,
  preview,
  quality,
  checkingQuality,
  onReplace,
  onContinue,
  busy
}: {
  file: File | null
  preview: string
  quality: ImageQuality | null
  checkingQuality: boolean
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
              <FileImage size={19} />
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
                  : ''
                }
              </p>

            </div>

          </div>


          <button
            onClick={onReplace}
            className="btn-secondary"
            disabled={busy || checkingQuality}
          >
            Replace image
          </button>

        </div>


        {checkingQuality && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">

            <div className="flex items-center gap-3">

              <Loader2
                size={18}
                className="animate-spin text-brand"
              />

              <div>

                <p className="font-semibold text-slate-800">
                  Checking image quality
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Checking focus, lighting and image resolution.
                </p>

              </div>

            </div>

          </div>
        )}


        {!checkingQuality &&
          quality?.quality === 'good' && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

              <div className="flex items-start gap-3">

                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand">
                  <Check size={18} />
                </div>

                <div>

                  <p className="font-semibold text-emerald-900">
                    Image quality looks good
                  </p>

                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    The image passed the basic focus,
                    brightness and resolution checks.
                  </p>

                </div>

              </div>

            </div>
          )}


        {!checkingQuality &&
          quality?.quality === 'needs_improvement' && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">

              <div className="flex items-start gap-3">

                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-700"
                />

                <div>

                  <p className="font-semibold text-amber-900">
                    Image quality could be improved
                  </p>

                  <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-800">

                    {quality.issues.map(
                      issue => (
                        <li key={issue}>
                          • {issue}
                        </li>
                      )
                    )}

                  </ul>

                  <p className="mt-3 text-xs leading-5 text-amber-700">
                    This check is only a basic image-quality heuristic.
                    It does not determine whether an image is medically
                    suitable or unsuitable.
                  </p>

                </div>

              </div>

            </div>
          )}


        <div className="mt-6 flex justify-end">

          <button
            onClick={onContinue}
            disabled={
              busy ||
              checkingQuality
            }
            className="btn-primary"
          >

            {busy ? (
              <>
                <Loader2
                  className="animate-spin"
                  size={17}
                />

                Uploading...
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


/* ============================================================
   ANALYSIS
============================================================ */

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


/* ============================================================
   QUESTIONS
============================================================ */

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
    value: string
  ) => void
  onBack: () => void
  onNext: () => void
  busy: boolean
}) {

  const [index, setIndex] =
    useState(0)

  const question =
    questions[index]

  if (!question) {
    return (
      <AnalysisPage
        text="Loading questions"
        detail="Preparing the relevant questions for this assessment."
      />
    )
  }

  const last =
    index === questions.length - 1

  const selected =
    answers[question.id]

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
            {index + 1} / {questions.length}
          </span>

        </div>


        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">

          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{
              width: `${(
                ((index + 1) /
                  questions.length) *
                100
              )}%`
            }}
          />

        </div>

      </div>


      <div className="card p-6 sm:p-8">

        <h2 className="text-xl font-semibold">
          {question.text}
        </h2>


        <div className="mt-6 grid gap-3">

          {question.options.map(
            option => (
              <button
                key={option}
                onClick={() =>
                  onAnswer(
                    question,
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
              index === 0
                ? onBack
                : () =>
                    setIndex(
                      value =>
                        value - 1
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

              <ArrowRight size={17} />

            </button>

          ) : (

            <button
              onClick={() =>
                setIndex(
                  value =>
                    value + 1
                )
              }
              disabled={!selected}
              className="btn-primary"
            >

              Next

              <ArrowRight size={17} />

            </button>

          )}

        </div>

      </div>

    </div>
  )
}


/* ============================================================
   RESULT
============================================================ */

function ResultPage({
  result,
  places,
  report,
  onStartOver
}: {
  result: AssessmentResult
  places: Place[]
  report: string
  onStartOver: () => void
}) {

  const demo =
    result.demo === true

  return (
    <div className="mx-auto max-w-6xl">

      {/* ------------------------------------------------------
          Header
      ------------------------------------------------------ */}

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
                : 'AI-assisted screening support based on the information provided.'
              }
            </p>

          </div>


          <a
            href={
              demo
                ? '#backend-required'
                : report
            }
            onClick={event => {

              if (demo) {
                event.preventDefault()

                document
                  .getElementById(
                    'backend-required'
                  )
                  ?.scrollIntoView({
                    behavior: 'smooth'
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

            <FileDown size={23} />

            <span>

              <b>
                {demo
                  ? 'PDF ready after backend connection'
                  : 'Download Screening Summary'
                }
              </b>

              <small>
                {demo
                  ? 'Connect FastAPI to generate the real PDF'
                  : 'Open the backend-generated PDF'
                }
              </small>

            </span>

          </a>

        </div>

      </div>


      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">

        {/* ==================================================
            IMAGE ANALYSIS
        ================================================== */}

        <section className="card p-6 sm:p-8">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <h2 className="text-xl font-semibold">
              Image analysis
            </h2>

            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-brand">
              {demo
                ? 'Demo preview'
                : 'Screening support'
              }
            </span>

          </div>


          {demo ? (

            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">

              <b>
                Real model result is intentionally not shown in demo mode.
              </b>{' '}
              Once the backend is connected, this card displays the
              actual ML model output.

            </div>

          ) : (

            <>

              {/* Model metrics */}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">

                <Metric
                  label="Model prediction"
                  value={
                    result.prediction
                  }
                />

                <Metric
                  label="Model confidence"
                  value={`${result.confidence.toFixed(1)}%`}
                />

              </div>


              {/* Uncertainty */}

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
                    Skinova uses this as an uncertainty guardrail.
                    It is not a diagnosis.
                  </p>

                </div>

              )}


              {/* Grad-CAM */}

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


                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">

                    <img
                      src={result.gradcamUrl}
                      alt="Grad-CAM model attention overlay"
                      className="mx-auto w-full max-w-xl object-contain"
                    />

                  </div>


                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Highlighted regions show areas that
                    contributed to the classifier's prediction.
                    This is model attribution, not a clinical explanation.
                  </p>

                </div>

              )}


              {/* 7 class distribution */}

              {result.distribution.length > 0 && (

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
                              {item.code} · {item.name}
                            </span>

                            <span className="font-semibold text-slate-500">
                              {item.score.toFixed(1)}%
                            </span>

                          </div>


                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                            <div
                              className={`h-full rounded-full ${
                                item.code ===
                                result.distribution[0]
                                  ?.code
                                  ? 'bg-brand'
                                  : 'bg-slate-300'
                              }`}
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    item.score,
                                    100
                                  )
                                )}%`
                              }}
                            />

                          </div>

                        </div>

                      )
                    )}

                  </div>


                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    These are classifier output scores,
                    not medically calibrated disease probabilities.
                  </p>

                </div>

              )}


              {/* Explanation */}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">

                {result.explanation}

              </div>


              {/* Disclaimer */}

              {result.disclaimer && (

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">

                  {result.disclaimer}

                </div>

              )}


              {/* Screening Priority */}

              {result.priority && (

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <div>

                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        Screening priority
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        This is not a clinically validated risk score.
                      </p>

                    </div>

                    <span
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        result.priority === 'Higher'
                          ? 'bg-red-50 text-red-700'
                          : result.priority === 'Moderate'
                            ? 'bg-amber-50 text-amber-800'
                            : result.priority === 'Lower'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {result.priority}
                    </span>

                  </div>

                  {result.urgency && (

                    <p className="mt-3 text-sm font-medium text-slate-700">
                      {result.urgency}
                    </p>

                  )}

                </div>

              )}

            </>

          )}


          {/* Key factors */}

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
            NEXT STEPS + EVIDENCE
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


          {/* Evidence Trail */}

          <div className="mt-8 border-t border-slate-200 pt-6">

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Evidence trail
            </p>

            <h3 className="mt-1 font-semibold">
              Relevant medical information
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {demo
                ? 'This section will be populated from the RAG service when the backend is connected.'
                : 'The screening explanation is supported by information retrieved from the configured medical knowledge base.'
              }
            </p>


            {result.sources &&
            result.sources.length > 0 ? (

              <div className="mt-4 space-y-3">

                {result.sources.map(
                  source => (

                    <div
                      key={source.title}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <p className="text-sm font-semibold text-slate-800">
                          {source.title}
                        </p>


                        {source.url ? (

                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand underline"
                          >
                            Source
                            <ExternalLink size={12} />
                          </a>

                        ) : (

                          <span className="text-xs text-slate-400">
                            Source unavailable
                          </span>

                        )}

                      </div>


                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Retrieved medical information used
                        to support the screening explanation.
                      </p>

                    </div>

                  )
                )}

              </div>

            ) : (

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No source metadata is available for this assessment.
              </div>

            )}

          </div>

        </section>

      </div>


      {/* ====================================================
          CONTEXT FLIP
      ==================================================== */}

      <section className="card mt-5 p-6 sm:p-8">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <p className="eyebrow">
              Context-aware screening
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Why context matters
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              The image classifier provides the visual signal.
              User-reported context helps determine the screening
              priority and recommended next step.
            </p>

          </div>

          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-brand">
            Same image · Different context
          </div>

        </div>


        <div className="mt-6 grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl bg-slate-50 p-5">

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Visual model
            </p>

            <p className="mt-2 text-lg font-semibold text-slate-900">
              {result.prediction}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {result.confidence.toFixed(1)}% top-class score
            </p>

          </div>


          <div className="rounded-2xl bg-slate-50 p-5">

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              User context
            </p>

            <ul className="mt-2 space-y-1 text-sm text-slate-700">

              {result.factors
                .slice(0, 4)
                .map(
                  factor => (
                    <li
                      key={factor}
                    >
                      • {factor}
                    </li>
                  )
                )}

            </ul>

          </div>


          <div className="rounded-2xl bg-emerald-50 p-5">

            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Recommended priority
            </p>

            <p className="mt-2 text-xl font-bold text-emerald-900">
              {result.priority || 'Uncertain'}
            </p>

            <p className="mt-1 text-sm text-emerald-800">
              {result.urgency || 'Review the generated screening guidance.'}
            </p>

          </div>

        </div>


        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">

          <p className="text-sm leading-6 text-emerald-900">

            <b>
              Same image does not necessarily mean the same next step.
            </b>{' '}
            Reported changes, symptoms and other contextual information
            can affect the screening priority.

          </p>

        </div>

      </section>


      {/* ====================================================
          NEARBY CARE
      ==================================================== */}

      <section className="card mt-5 p-6 sm:p-8">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <p className="eyebrow">
              Find professional care
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Nearby dermatology care
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Nearby results depend on browser location permission
              and the configured healthcare search service.
            </p>

          </div>


          <a
            href="https://www.google.com/maps/search/dermatologist"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            <MapPin size={17} />
            Search on Google Maps
          </a>

        </div>


        <div className="mt-6 grid gap-3 md:grid-cols-2">

          {places.length ? (

            places.map(
              place => (

                <div
                  key={`${place.name}-${place.address ?? ''}`}
                  className="rounded-2xl border border-slate-200 p-4"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div>

                      <h3 className="font-semibold">
                        {place.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {place.address ||
                          'Address unavailable'}

                        {place.distance
                          ? ` · ${place.distance}`
                          : ''
                        }
                      </p>

                    </div>


                    {place.rating != null && (

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
                    <ArrowRight size={15} />
                  </a>

                </div>

              )
            )

          ) : (

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900 md:col-span-2">

              No nearby care results were loaded.
              Use Google Maps to find a dermatologist nearby,
              or allow location access.

            </div>

          )}

        </div>

      </section>


      {/* ====================================================
          DISCLAIMER
      ==================================================== */}

      <div
        id="backend-required"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600"
      >

        <b className="text-slate-900">
          Screening disclaimer:
        </b>{' '}

        This tool is for screening and informational purposes only.
        It does not provide a medical diagnosis or replace evaluation
        by a qualified healthcare professional.

      </div>


      <div className="mt-6 flex justify-center">

        <button
          onClick={onStartOver}
          className="btn-secondary"
        >
          <RefreshCw size={16} />
          Start a new assessment
        </button>

      </div>

    </div>
  )
}


/* ============================================================
   SMALL COMPONENTS
============================================================ */

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

      <p className="mt-2 break-words text-2xl font-semibold text-slate-900">
        {value}
      </p>

    </div>
  )
}


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