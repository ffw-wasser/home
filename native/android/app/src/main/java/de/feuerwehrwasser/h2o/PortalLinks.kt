package de.feuerwehrwasser.h2o

import java.net.URI

/** Only the member portal and appointment entry point can receive native links. */
object PortalLinks {
    const val HOME = "https://ffw-wasser.github.io/home/deckel.html"
    private val paths = setOf("/home/deckel.html", "/home/termin.html")
    fun trusted(value: String): Boolean = runCatching {
        val url = URI(value)
        url.scheme == "https" && url.host == "ffw-wasser.github.io" &&
            url.rawAuthority == "ffw-wasser.github.io" && url.rawPath in paths && url.userInfo == null
    }.getOrDefault(false)

    fun setupLink(value: String): Boolean = runCatching {
        val url = URI(value)
        trusted(value) && url.rawPath == "/home/deckel.html" && url.rawQuery == null &&
            Regex("setup=[A-Za-z0-9_-]{43}").matches(url.rawFragment ?: "")
    }.getOrDefault(false)

    fun widgetLink(value: String): Boolean = value == "h2oportal://termine"

    fun calendarSubscription(value: String): Boolean = runCatching {
        val url = URI(value)
        url.scheme == "webcal" && url.rawAuthority == "feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev" && Regex("/calendar/member/[A-Za-z0-9_-]{43}\\.ics").matches(url.rawPath) && url.rawQuery == null && url.rawFragment == null && url.userInfo == null
    }.getOrDefault(false)
}
