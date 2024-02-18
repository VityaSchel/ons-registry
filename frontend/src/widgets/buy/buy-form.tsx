import React from 'react'
import { useTranslation } from 'next-i18next'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { Input } from '@/shared/shadcn/ui/input'
import { Button } from '@/shared/shadcn/ui/button'
import { Key } from 'ts-key-enum'
import cx from 'classnames'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group'
import { Label } from '@/shared/shadcn/ui/label'

export function BuyForm() {
  const { name } = useRouter().query
  const nameString = name ? Array.isArray(name) ? name[0] : name : ''
  const { t, i18n } = useTranslation('buy')
  const [nameTaken, setNameTaken] = React.useState(false)
  // const [nameTakenTimeout, setNameTakenTimeout] = React.useState<NodeJS.Timeout | undefined>()
  const [nameCheckAbort, setNameCheckAbort] = React.useState<undefined | (() => void)>()
  const basePrice = { rub: '450', usd: '5' }
  const [price, setPrice] = React.useState(basePrice)
  const [couponNotFound, setCouponNotFound] = React.useState(false)
  const router = useRouter()

  const handleCheckName = (name: string) => {
    const abort = new AbortController()
    // eslint-disable-next-line no-async-promise-executor
    new Promise<void>(async () => {
      if (new RegExp('^\\w([\\w-]*[\\w])?$', 'g').test(name)) {
        const request = await fetch(process.env.NEXT_PUBLIC_API_URL + '/session/' + name, { signal: abort.signal })
        if (request.status !== 200 && request.status !== 404) return setNameTaken(false)
        const response = await request.json() as { ok: false, error: string } | { ok: true, mappings: object[] }
        if (response.ok && response.mappings.length > 0) {
          setNameTaken(true)
        } else {
          setNameTaken(false)
        }
      }
    })
    return () => abort.abort()
  }

  React.useEffect(() => {
    if (nameString) {
      handleCheckName(nameString)
    }
  }, [nameString])

  return (
    <div className='mt-12 lg:mt-[10vh] flex flex-col gap-5 max-w-full items-center px-4 md:px-10'>
      <div className='top-0 absolute w-screen h-[1400px] max-h-screen overflow-hidden pointer-events-none'>
        <div className='pointer-events-none absolute top-[-500px] left-[-500px] bg-gradient-radial w-[1200px] h-[1200px] from-indigo-900 gradien via-transparent to-transparent opacity-20'></div>
        <div className='pointer-events-none absolute right-[-700px] top-[-200px] bg-gradient-radial w-[1200px] h-[1200px] from-indigo-900 gradien via-transparent to-transparent opacity-10'></div>
      </div>
      <div className='flex gap-16 xl:gap-32 flex-col lg:flex-row justify-between max-w-full w-[1200px]'>
        <div className='flex flex-col gap-8 max-w-[600px] w-full'>
          <Link href='/' className='self-start'>
            <Button variant={'ghost'} className='-ml-4 flex items-center' tabIndex={-1}>
              <ArrowLeft size={16} className='mr-2' /> {t('go_back')}
            </Button>
          </Link>
          <h1 className='scroll-m-20 text-3xl font-extrabold tracking-tight md:text-5xl text-left'>{t('heading')}</h1>
          <p className='text-left font text-base md:text-md'>{t('description')}</p>
          <Formik
            initialValues={{
              name: nameString,
              wallet: 'new',
              coupon: '',
              sessionid: '',
              email: '',
              owner: ''
            }}
            validationSchema={
              Yup.object({
                name: Yup.string()
                  .matches(new RegExp('^\\w([\\w-]*[\\w])?$', 'g'), t('errors.name_invalid'))
                  .max(64, t('errors.name_too_long'))
                  .required(t('errors.name_required')),
                coupon: Yup.string()
                  .min(6, t('errors.coupon_invalid'))
                  .max(36, t('errors.coupon_invalid'))
                  .matches(/^[a-zA-Z0-9_]+$/, t('errors.coupon_invalid')),
                sessionid: Yup.string()
                  .length(66, t('errors.sessionid_invalid'))
                  .matches(/^[a-z0-9]+$/, t('errors.sessionid_invalid'))
                  .required(t('errors.sessionid_required')),
                owner: Yup.string()
                  .length(95, t('errors.owner_invalid'))
                  .matches(/[a-zA-Z]+/, t('errors.owner_invalid')),
                email: Yup.string()
                  .email(t('errors.email_invalid'))
              })
            }
            onSubmit={async (values) => {
              try {
                const request = await fetch(process.env.NEXT_PUBLIC_API_URL + '/purchase/invoice', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: values.name,
                    sessionID: values.sessionid,
                    ...(values.coupon && { coupon: values.coupon }),
                    currency: 'rub',
                    ...(values.email && { email: values.email }),
                    language: i18n.language === 'ru' ? 'ru' : 'en',
                    owner: values.owner
                  })
                })
                if (String(request.status).startsWith('5')) {
                  toast.error(t('errors.internal_server_error'))
                  console.error(await request.text())
                } else {
                  const response = await request.json() as { ok: true, redirect: string } | { ok: false, error: string }
                  if (response.ok) {
                    router.push(response.redirect)
                  } else {
                    if(response.error === 'NAME_OCCUPIED') {
                      toast.error(t('errors.name_occupied'))
                    } else {
                      toast.error(response.error)
                    }
                  }
                }
              } catch(e) {
                toast.error(t('errors.fetch_failed'))
                console.error(e)
              }
            }}
          >
            {({
              values,
              errors,
              touched,
              handleChange,
              handleBlur,
              handleSubmit,
              isSubmitting,
              setFieldValue
              /* and other goodies */
            }) => {
              const handleCheckCoupon = async (coupon: string) => {
                setCouponNotFound(false)
                if (coupon === '') return setPrice(basePrice)
                const request = await fetch(process.env.NEXT_PUBLIC_API_URL + '/purchase/promo/' + coupon)
                const response = await request.json() as { ok: false, error: string } | { ok: true, price: { usd: string, rub: string } }
                if (response.ok) {
                  setPrice(response.price)
                } else {
                  if(response.error === 'NOT_FOUND') {
                    setCouponNotFound(true)
                  } else {
                    toast.error(response.error)
                  }
                  setPrice(basePrice)
                }
              }

              return (
                <form onSubmit={handleSubmit} className='flex flex-col gap-2 w-auto items-start'>
                  <div className='flex flex-col gap-1 w-full'>
                    <Input
                      name="name"
                      onChange={e => {
                        handleChange(e)
                        setNameTaken(false)
                        nameCheckAbort?.()
                        setNameCheckAbort(() => handleCheckName(e.target.value))
                      }}
                      onBlur={e => {
                        handleBlur(e) 
                        setNameCheckAbort(() => handleCheckName(e.target.value))
                      }}
                      value={values.name}
                      placeholder={t('fields.name')}
                    />
                    {((errors.name && touched.name) || nameTaken) && <span className='text-red-600 text-sm ml-2 mb-1'>{errors.name ?? (nameTaken ? t('errors.name_taken') : '')}</span>}
                  </div>
                  <div className='flex flex-col gap-1 w-full'>
                    <Input
                      name="sessionid"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.sessionid}
                      placeholder={t('fields.sessionid')}
                    />
                    {errors.sessionid && touched.sessionid && <span className='text-red-600 text-sm ml-2 mb-1'>{errors.sessionid}</span>}
                  </div>
                  <RadioGroup 
                    name='wallet'
                    value={values.wallet} 
                    onValueChange={newValue => setFieldValue('wallet', newValue)} 
                    className='flex gap-6 flex-row mt-2'
                  >
                    <div className="flex space-x-2">
                      <RadioGroupItem value='new' id='new-wallet' className='mt-1' />
                      <Label htmlFor='new-wallet' className='leading-5'>{t('fields.wallet_type.new')}</Label>
                    </div>
                    <div className="flex space-x-2">
                      <RadioGroupItem value='owned' id='owned-wallet' className='mt-1' />
                      <Label htmlFor='owned-wallet' className='leading-5'>{t('fields.wallet_type.owned')}</Label>
                    </div>
                  </RadioGroup>
                  {values.wallet === 'new' && (
                    <div className='flex flex-col gap-1 w-full'>
                      <Input
                        name="email"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.email}
                        placeholder={t('fields.email')}
                      />
                      <span className='text-neutral-600 text-sm ml-2 mb-1'>{t('fields.email_hint')}</span>
                      {errors.email && touched.email && <span className='text-red-600 text-sm ml-2 mb-1'>{errors.email}</span>}
                    </div>
                  )}
                  {values.wallet === 'owned' && (
                    <div className='flex flex-col gap-1 w-full'>
                      <Input
                        name="owner"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.owner}
                        placeholder={t('fields.owner')}
                        maxLength={95}
                      />
                      <span className='text-neutral-600 text-sm ml-2 mb-1'>{t('fields.owner_hint')}</span>
                      {errors.owner && touched.owner && <span className='text-red-600 text-sm ml-2 mb-1'>{errors.owner}</span>}
                    </div>
                  )}
                  <div className='flex flex-col gap-1 w-full'>
                    <Input
                      name="coupon"
                      onChange={handleChange}
                      value={values.coupon}
                      placeholder={t('fields.coupon')}
                      onKeyDown={e => {
                        if(e.key === Key.Enter) {
                          handleCheckCoupon(values.coupon.trim())
                        }
                      }}
                      onBlur={e => {
                        handleBlur(e)
                        handleCheckCoupon(e.target.value.trim())
                      }}
                      className={cx('transition-all mt-2', { 'border-red-600': couponNotFound })}
                    />
                    {errors.coupon && touched.coupon && <span className='text-red-600 text-sm ml-2 mb-1'>{errors.coupon}</span>}
                  </div>
                  <span className='text-2xl my-2'>{t('final_price')}: <span  className='font-bold'>{price.rub + ' ₽'}</span></span>
                  <Button type="submit" disabled={isSubmitting || nameTaken || !values.sessionid || !values.name || Object.values(errors).filter(Boolean).length > 0 || (values.wallet === 'owned' && !values.owner)}>
                    {t('submit.with_yookassa')}
                  </Button>
                </form>
              )
            }}
          </Formik>
        </div>
        <div className='flex flex-col gap-2 flex-1 mt-12'>
          <Faq title={t('faq.about_ons.title')} content={t('faq.about_ons.description')} />
          <Faq title={t('faq.purchase.title')} content={t('faq.purchase.description')} />
          <Faq title={t('faq.contacts.title')} content={t('faq.contacts.description')} />
        </div>
      </div>
    </div>
  )
}

function Faq({ title, content }: {
  title: string
  content: string
}) {
  return (
    <div className='flex flex-col leading-tight'>
      <h2 className='text-faq'>{title}</h2>
      <p className='text-faq text-xs font-normal'>{content}</p>
    </div>
  )
}