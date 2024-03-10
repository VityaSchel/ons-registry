export async function sendReceiptToSession(sessionID: string, content: {
  name: string, language: 'ru' | 'en', txHash: string
} & ({ seedPhrase: string } | { ownerOxen: string })) {
  try {
    let text
    if (content.language === 'ru') {
      text = content.name + `, поздравляем с покупкой имени на https://ons.sessionbots.directory/ 🎉 Ваше имя уже активно и вас уже можно найти по нему в Session. Запись о покупке в блокчейне: https://oxen.observer/tx/${content.txHash} Если вы еще не можете перейти по вашему имени, подождите до 20 минут для подтверждения блокчейном.`

      if ('seedPhrase' in content) {
        text += '\n\nЕсли вы захотите управлять своим именем (например, привязать это имя к другому Session ID), вам потребуется установить официальное приложение OXEN Wallet и ввести туда эту мнемоническую фразу для доступа к кошельку, с которого был куплен маппинг: ' + content.seedPhrase + '. НИКОМУ НЕ ПОКАЗЫВАЙТЕ ЭТУ ФРАЗУ — она дает доступ к купленному вами имени в блокечейне и с помощью неё можно перепривязать никнейм к другому аккаунту.'
      } else {
        text += `\n\nВо время покупки вы указали собственный кошелек OXEN, к которому привязался никнейм: ${content.ownerOxen}. Помните, что имея доступ к этому кошельку OXEN, можно перепривязать ваш никнейм к другому аккаунту Session, поэтому никому не передавайте доступ от этого кошелька.`
      }

      text += ' '
      text += 'Пожалуйста, имейте в виду, что мы никак не связаны с OXEN и Session и не можем управлять блокчейном, а также помочь с вопросами, связанными с этим. Наш сайт не поддерживает управление вашим именем после покупки.'

      text += '\n\nЕсли у вас возникли вопросы, пожалуйста, обращайтесь к нам в Telegram: @hlothdev (предпочтительно) или по e-mail: onspurchase@hloth.dev или по Session никнейму: hloth (самый медленный ответ). Этот аккаунт используется для автоматической отправки чеков, поэтому, пожалуйста, не отправляйте ему сообщения — они не будут доставлены и прочитаны.'

      text += '\n\nСпасибо за покупку и ждем вас снова!'
    } else {
      text = content.name + `, congratulations on your purchase at https://ons.sessionbots.directory/ 🎉! Your name is already active and you can already be found by it in Session. Here is the blockchain purchase record: https://oxen.observer/tx/${content.txHash} If you still can't go to your nickname, please allow up to 20 minutes for confirmation by the OXEN blockchain).`

      if ('seedPhrase' in content) {
        text = '\n\nIf you want to manage your name (for example, bind this name to another Session ID), you will need to install the official OXEN Wallet app and enter this see phrase (mnemonic) there: ' + content.seedPhrase + '. DO NOT SHARE THIS PHRASE WITH ANYONE - it gives access to the name you just bought. '
      } else {
        text += `\n\nWhen purchasing, you specified your own OXEN wallet, to which the nickname was linked: ${content.ownerOxen}. Remember that anyone having access to this OXEN wallet can rebind your nickname to another Session account, so do not share access to this wallet to anyone.`
      }

      text += ' '
      text += 'Please note that we are not affiliated with OXEN, Session and cannot control the blockchain, as well as help with issues related to this. Our site does not support managing your name after purchase.'

      text += '\n\nIf you have any questions, please contact us at Telegram: @hlothdev (preferrably) or by e-mail: onspurchase@hloth.dev or by Session nickname: hloth (slow to response). This account is used to automatically send receipts, so please do not send messages to it — they won\'t be delivered and seen.'

      text += '\n\nThank you for your purchase and we\'re hoping to see you again soon!'
    }

    const response = await fetch('http://localhost:6803/receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionID,
        text
      })
    })
      .then(res => res.json() as Promise<{ ok: true } | { ok: false, error: string }>)

    if (!response.ok) {
      throw new Error(response.error)
    }
  } catch (e) {
    console.error('Failed to send receipt', e)
  }
}