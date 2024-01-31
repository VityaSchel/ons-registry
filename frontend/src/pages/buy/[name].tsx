import { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'

export default function BuyNamePageRedirect() {
  return null
}

export function getServerSideProps(context: GetServerSidePropsContext<{ name: string }>): GetServerSidePropsResult<Record<string, never>> {
  return {
    props: {},
    redirect: {
      destination: '/buy?' + context.params?.name,
      permanent: false,
    }
  }
}