"""Synthetic browser QA for the isolated Sync Opps. first-member beta preview.

Install: pip install playwright && python -m playwright install chromium
Run: python qa/tests/test_beta_member_sandbox.py
No live networking, forms, accounts, music, or email is used.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
html_file=Path(__file__).resolve().parents[1] / 'beta-member-sandbox.html'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'],**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}))
    page=browser.new_page(viewport={'width':1365,'height':980}, device_scale_factor=1,accept_downloads=False)
    network=[]; errors=[]
    page.on('request',lambda r:network.append(r.url) if r.url.startswith('http') else None)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html_file.read_text(encoding='utf-8'),wait_until='load')
    assert page.locator('#trackCard').is_visible()
    assert page.locator('#listingCount').inner_text()=='1'
    assert page.locator('#testPlayer').get_attribute('src').startswith('blob:')
    # Screenshots are saved by the development operator on demand, not to a fixed user-specific path
    page.locator('#licenseButton').click()
    assert page.locator('#licenseDialog').is_visible()
    rights=page.locator('#licenseDialog').inner_text()
    for x in ['Composition and songwriter','Publishing','Master / sound recording','QA Example Writer','QA Example Publishing','QA Example Masters']:
        assert x in rights,x
    assert rights.count('100%')>=3
    page.locator('[data-close="licenseDialog"]').click()
    page.locator('#inquiryButton').click()
    page.locator('#buyerName').fill('QA Example Buyer')
    page.locator('#buyerEmail').fill('qa@example.invalid')
    page.locator('#mediaType').select_option(label='Film')
    page.locator('#buyerMessage').fill('QA simulated song inquiry for a short film, no real rights offer')
    page.locator('#sendInquiry').click()
    assert page.locator('#inquiryResult').is_visible()
    assert page.locator('#inquiryCount').inner_text()=='1'
    page.locator('[data-close="inquiryDialog"]').first.click()
    player=page.locator('#testPlayer')
    player.evaluate('(a)=>a.play()')
    page.wait_for_timeout(550)
    isplaying=player.evaluate('(a)=>!a.paused && a.currentTime>0')
    assert isplaying,player.evaluate('(a)=>({paused:a.paused,t:a.currentTime,error:a.error?.message})')
    page.locator('#scenario').select_option('withdrawn')
    page.locator('#applyScenario').click()
    assert page.locator('#trackCard').is_hidden()
    assert page.locator('#blockedCard').is_visible()
    assert page.locator('#listingCount').inner_text()=='0'
    assert player.evaluate('(a)=>a.paused && !a.hasAttribute("src")')
    page.locator('#resetScenario').click()
    assert page.locator('#trackCard').is_visible()
    assert page.locator('#listingCount').inner_text()=='1'
    assert player.get_attribute('src').startswith('blob:')
    for state in ['unverified','beta','hosting','rights','paused']:
        page.locator('#scenario').select_option(state)
        page.locator('#applyScenario').click()
        assert page.locator('#trackCard').is_hidden(),state
        assert page.locator('#listingCount').inner_text()=='0',state
    page.locator('#resetScenario').click()
    assert page.locator('#trackCard').is_visible()
    assert page.locator('#inquiryCount').inner_text()=='1'
    page.set_viewport_size({'width':390,'height':844})
    # The 390px viewport and horizontal overflow are still verified below
    body_w=page.evaluate('document.documentElement.scrollWidth')
    assert body_w<=390,f'horizontal overflow: {body_w}'
    assert not network,network
    assert not errors,errors
    print({'browser':'Chromium','desktop':'PASS','rightsModal':'PASS, 3 distinct 100% totals','localWavPlayback':'PASS','mockInquiry':'PASS, 1 captured, no email','withdrawalStopsAudio':'PASS','reset':'PASS','blockedStates':'PASS x5','mobileWidth':'PASS','externalHTTPRequests':len(network),'javascriptErrors':len(errors)})
    browser.close()
