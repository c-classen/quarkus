package io.quarkus.infinispan.client.runtime.cache;

import java.util.concurrent.CompletionStage;
import java.util.function.Function;
import java.util.function.Supplier;

import jakarta.annotation.Priority;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;

import org.infinispan.client.hotrod.RemoteCache;
import org.infinispan.commons.CacheException;
import org.jboss.logging.Logger;

import io.quarkus.infinispan.client.CacheInvalidateAll;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;

@CacheInvalidateAll(cacheName = "") // The `cacheName` attribute is @Nonbinding.
@Interceptor
@Priority(CacheInterceptor.BASE_PRIORITY)
public class CacheInvalidateAllInterceptor extends CacheInterceptor {

    private static final Logger LOGGER = Logger.getLogger(CacheInvalidateAllInterceptor.class);
    private static final String INTERCEPTOR_BINDINGS_ERROR_MSG = "The Quarkus Infinispan Client extension is not working properly (CacheInvalidateAll interceptor bindings retrieval failed), please create a GitHub issue in the Quarkus repository to help the maintainers fix this bug";

    @AroundInvoke
    public Object intercept(InvocationContext invocationContext) throws Exception {
        CacheInterceptionContext<CacheInvalidateAll> interceptionContext = getInterceptionContext(invocationContext,
                CacheInvalidateAll.class);
        if (interceptionContext.getInterceptorBindings().isEmpty()) {
            // This should never happen.
            LOGGER.warn(INTERCEPTOR_BINDINGS_ERROR_MSG);
            return invocationContext.proceed();
        }
        ReturnType returnType = determineReturnType(invocationContext.getMethod().getReturnType());
        if (returnType == ReturnType.NonAsync) {
            return invalidateAllBlocking(invocationContext, interceptionContext);
        }
        return invalidateAllNonBlocking(invocationContext, interceptionContext, returnType);
    }

    private Object invalidateAllNonBlocking(InvocationContext invocationContext,
            CacheInterceptionContext<CacheInvalidateAll> interceptionContext, ReturnType returnType) {
        LOGGER.trace("Invalidating all cache entries in a non-blocking way");
        var uni = Multi.createFrom().iterable(interceptionContext.getInterceptorBindings())
                .onItem().transformToUniAndMerge(new Function<CacheInvalidateAll, Uni<? extends Void>>() {
                    @Override
                    public Uni<Void> apply(CacheInvalidateAll binding) {
                        return invalidateAll(binding);
                    }
                })
                .onItem().ignoreAsUni()
                .onItem().transformToUni(new Function<Object, Uni<?>>() {
                    @Override
                    public Uni<?> apply(Object ignored) {
                        try {
                            return asyncInvocationResultToUni(invocationContext.proceed(), returnType);
                        } catch (Exception e) {
                            throw new CacheException(e);
                        }
                    }
                });
        return createAsyncResult(uni, returnType);
    }

    private Object invalidateAllBlocking(InvocationContext invocationContext,
            CacheInterceptionContext<CacheInvalidateAll> interceptionContext) throws Exception {
        LOGGER.trace("Invalidating all cache entries in a blocking way");
        for (CacheInvalidateAll binding : interceptionContext.getInterceptorBindings()) {
            invalidateAll(binding).await().indefinitely();
        }
        return invocationContext.proceed();
    }

    private Uni<Void> invalidateAll(CacheInvalidateAll binding) {
        RemoteCache cache = cacheManager.getCache(binding.cacheName());
        LOGGER.debugf("Invalidating all entries from cache [%s]", binding.cacheName());
        return Uni.createFrom().completionStage(new Supplier<>() {
            @Override
            public CompletionStage<Void> get() {
                return cache.clearAsync();
            }
        });
    }
}
