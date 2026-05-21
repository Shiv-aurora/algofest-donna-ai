import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const root = process.cwd();
const screens = [
  {
    name: 'overview',
    source: 'deisgn-pack/overview_quiet_canvas_refined/code.html',
    replacements: {
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAmrYi5E4jHCkFFcbspu5O3xdye7S_xVCHyZdv923mq_D6zk6rO5pbgp-qzMrfMrMtLjNSEnFKibbUOUQCFidEWu-yjVYk0MG5H_yQoGt7QMbv5Rn3EEJ50sb3NCr2xlPyecrZ8I_YXC4RoNQ2pD26Mkx4azRyJ8J_lDd-mrpEjBkuIuErFIfXi__OSwFCbxGiEZFl4lkwq4nVRR6Bw0VrPy--oEqTBs-O99XBL5FRoU2Doo4zIbp4-1Axx0jIPDKopbMjS8B2SxaI': '/images/overview-profile.jpg',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAqSKd37wJd8ujadW9y63-fbD8svU8OrD0dnn2gSbDWWfUQW_SvCBvW7pQGblF2FhP1odXc_celc5EDM3mjR613aGBCwmLDcoFbiyfYCRipejKoAA5afQIZ3_pkT0pJ-rSyQt2b9hF0fiU9j-jvTWrTGN_RXNdZgOpJUV1s6FEabcsbveyloGvcU-ZEayoTNbIkeEl0btOZfWBDnF3vPL6Da_Qn_9r2UUU90lGHn_D9G7k4r51PTU2hmVb3TlmXbzn9W4p3XHJ-1kc': '/images/overview-study.jpg'
    }
  },
  {
    name: 'today',
    source: 'deisgn-pack/today_quiet_canvas/code.html',
    replacements: {
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBgmpV5TwGfCHXczTPiPfbR_q4yE4KUdO6kKaGVGVHggZ2WXYbaOPOq-cBL-E1M1KhXznw-4HLveml1pN7lJ8cYWTZINJ8cQ_YphhT_Kqb2074Rd5ZfcfdXvvWnnnEJjsHvZaijrU9QxgTxNcyhTSEiT5ZO-1vCE17NPXTUCv7yAr9VdXBlp4Rq5ofFhsLFrEEdv5k0MIP_Tyy0PZRBaX9Mxugciv20NvWAUtP38hpg8X-sHPNYF4Ots9i3O6GXfxngynu2vYUCw2M': '/images/today-profile.jpg',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuChvIgLLm1x1LHb0wco6knbn6swyqWrGjwQa2DtDMTg1dk2Y_oYmKZHhcMsfhGtiAdhs0f3rLc1oJstNtgRnb0opBQP4mDYEqWpvSC64oUY-ToxGPjzpj7TiS1oeagU44xP-EKlytGPrmdMpBGzyR-KHZ5rUW-AqK_JKTi7VJ1VjX5oERM0N0ago8DkVX90M50YuV0iWv_xaK86_67eYtlStBe_l0JzWmcjRK-m2JyWT3fi3E6HM_5hyKDObtHL9_3Z-0pfafV8uwM': '/images/today-workspace.jpg'
    }
  },
  {
    name: 'assignments',
    source: 'deisgn-pack/assignments_quiet_canvas/code.html',
    replacements: {
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAhX7u7kc3UzXLJWL8Gt4_LPxdWSPT77NUwLyQe2SSu4kIoTcSD7Q12XKY66c_KZ2mcW5RpkCuTpruYF2RqKVOdAkp2dqTwrJiS_L894FqdvbObaEr2QMrwzBtgQjSeYgZB1GtjY2lEMzuZOebvMpUZmBsSviE_iKb8y3OMBp_F67GdyYElgrmdNuL1ejQRg4ynTLl1_SzV4cW0KHQcYJC2AarArzcukYLbrLOA1FkUfBehe32Za1HEbztxH0C82cWvQFpeZJAWLgY': '/images/assignments-profile.jpg',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCQeFf9g0Mpqw0N5ZfYouvbS-a8nxdL2xKNrJmbrfc_3SoYhJRmn6dYdRApGVG-HqS6sXbhBb-iEY_74hlEcZ2C6K6Ao1LF8ISPj9x_vXxhZeF0DG9HvA5p9z27BCd8v422JWBxiN6cZzj_HI7AVkhEmsEULFQs5cOIw1zqKgWDmE2QTvNT_Ypb6M0Tn89j-vZVaGheyJ8CK-a7USTGn4rlZMN_Su6WXfW4Y017pm8FdGSf8mPyQ4z5e-QwzFURpt3AFChKTRStDyg': '/images/assignments-library.jpg'
    }
  },
  {
    name: 'calendar',
    source: 'deisgn-pack/calendar_quiet_canvas/code.html',
    replacements: {
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDKHGPJs06u40O9iOcHj-Pxy5okBGMro5qN3ewB7ElybXMaVo5yGY2jxA2Xsoxfzvl7zj5yF9xJpjaG_R-uTniJ4_ZqpBcQ7YsaIZjgQ8GNbsVHax3MEKFmHBJKMkQhbR7qqW_c0k3aM8kVy0zLCiML7U86A9u-QVTxVE9ZccJjD9IogTagMcJiV91dRjAqAV4JekG4SIPbGx76VG7102Tw_0J_FXfQrqNlpKtmjM-l4HiOfaBPGS_VkavtUpwkppD_NAT9fGU2vDI': '/images/calendar-profile.jpg',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDR-Y8k2jAcmmcjm2I8HTdfVgTwhaJ2YYTBvYTT-xbHNH231s_1hA8ZuO1MCxOL1oYetzqVKrgmKRVVRegcZYOj98bpJwdtp-gNZZjESYhsT37jcB0I-_BBSVUHJogbirk6hCyQIEVl19-JZA8AYDBg0tp74LsQTMR2wucMOON9cGW6oYICO2rMByWznpIxR5Ufnx8RorTNhXvpt0ajXT8H6E5KCaw4QuWxx8THW65_z9b7ytFPjg372xQGW6Y71U2zL6vF9m1f6-g': '/images/calendar-focus.jpg'
    }
  }
];

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destination);
        resolve(download(response.headers.location, destination));
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (error) => {
      file.close();
      reject(error);
    });
  });
}

async function main() {
  for (const screen of screens) {
    const sourcePath = path.join(root, screen.source);
    const html = fs.readFileSync(sourcePath, 'utf8');
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) {
      throw new Error(`Could not extract <body> from ${screen.source}`);
    }

    let fragment = bodyMatch[1].trim();
    for (const [remote, local] of Object.entries(screen.replacements)) {
      const localPath = path.join(root, 'public', local.replace(/^\//, ''));
      if (!fs.existsSync(localPath)) {
        await download(remote, localPath);
      }
      fragment = fragment.split(remote).join(local);
    }

    const fragmentPath = path.join(root, 'src', 'fragments', `${screen.name}.html`);
    fs.writeFileSync(fragmentPath, fragment + '\n');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
